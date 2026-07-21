import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { protectionExpiry } from "../services/economy";
import { getWallet, transfer } from "../services/wallet";

const router = Router();
router.use(requireAuth);

// Venta abierta en la liga: cualquier mánager puede comprar al precio fijado.
router.get("/", async (req, res) => {
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const listings = await prisma.playerListing.findMany({
    where: { leagueId },
    include: { player: { include: { team: true } }, seller: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ listings });
});

const createSchema = z.object({
  leagueId: z.string().min(1),
  playerId: z.number().int(),
  price: z.number().int().min(1, "El precio debe ser mayor a 0"),
});

router.post("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, playerId, price } = parsed.data;

  const owned = await prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } });
  if (!owned || owned.userId !== userId) return res.status(400).json({ error: "Esa carta no es tuya en esta liga" });

  const existing = await prisma.playerListing.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } });
  if (existing) return res.status(409).json({ error: "Ese jugador ya está en venta" });

  const listing = await prisma.playerListing.create({
    data: { leagueId, playerId, price, sellerId: userId },
    include: { player: { include: { team: true } }, seller: { select: { id: true, name: true } } },
  });
  res.status(201).json({ listing });
});

router.delete("/:id", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const listing = await prisma.playerListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: "Publicación no encontrada" });
  if (listing.sellerId !== userId) return res.status(403).json({ error: "No puedes cancelar la venta de otro mánager" });

  await prisma.playerListing.delete({ where: { id: listing.id } });
  res.json({ ok: true });
});

router.post("/:id/buy", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const listingId = req.params.id;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Obtener la publicación del jugador (solo lectura preliminar)
      const initialListing = await tx.playerListing.findUnique({
        where: { id: listingId },
        select: { sellerId: true, playerId: true, leagueId: true }
      });

      if (!initialListing) {
        throw new Error("La publicación ya no está disponible.");
      }

      if (initialListing.sellerId === userId) {
        throw new Error("No puedes comprar tu propio jugador.");
      }

      // REGLA DE LOCKING 1: Bloquear Users de forma ordenada alfabéticamente
      const sortedUserIds = [userId, initialListing.sellerId].sort();
      for (const uid of sortedUserIds) {
        await tx.$queryRaw`
          SELECT id, coins FROM "User" WHERE id = ${uid} FOR UPDATE
        `;
      }

      // REGLA DE LOCKING 2: Bloquear fila en OwnedPlayer (O antes que P)
      const ownedRows = await tx.$queryRaw<any[]>`
        SELECT id, "userId" FROM "OwnedPlayer" 
        WHERE "leagueId" = ${initialListing.leagueId} AND "playerId" = ${initialListing.playerId} 
        FOR UPDATE
      `;
      const ownedRecord = ownedRows[0];
      
      // Confirmar que el vendedor actual sigue siendo el poseedor legítimo de la carta
      if (!ownedRecord || ownedRecord.userId !== initialListing.sellerId) {
        await tx.playerListing.deleteMany({ where: { id: listingId } });
        throw new Error("El vendedor ya no posee esta carta. Listado cancelado.");
      }

      // REGLA DE LOCKING 3: Bloquear y leer fila completa de PlayerListing (PL después de O)
      const listings = await tx.$queryRaw<any[]>`
        SELECT id, "sellerId", "playerId", price, "leagueId" 
        FROM "PlayerListing" WHERE id = ${listingId} FOR UPDATE
      `;
      const lockedListing = listings[0];
      if (!lockedListing) {
        throw new Error("El listado ya fue vendido o removido.");
      }

      // REGLA DE LOCKING 4: Bloquear SystemAccount (S después de P)
      const systemAccounts = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "SystemAccount" WHERE id = 'SYSTEM_TAX' FOR UPDATE
      `;
      if (!systemAccounts[0]) {
        throw new Error("SYSTEM_TAX no inicializado.");
      }

      // Validar saldo del comprador con datos bloqueados
      const buyer = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
      if (!buyer || buyer.coins < lockedListing.price) {
        throw new Error("Saldo de monedas insuficiente para la compra.");
      }

      // Consultar umbrales para tasa variable
      const activeStats = await tx.leagueStats.findFirst({
        where: { leagueId: lockedListing.leagueId },
        orderBy: { calculatedAt: "desc" }
      });

      const seller = await tx.user.findUnique({ where: { id: lockedListing.sellerId }, select: { coins: true } });
      let taxPercentage = 0.05; // 5% base

      if (activeStats && activeStats.giniIndex > 0.45 && seller && seller.coins > activeStats.top25PercentileCoinsThreshold) {
        taxPercentage = 0.075; // 7.5% progresivo
      }

      const taxAmount = Math.round(lockedListing.price * taxPercentage);
      const sellerNetReceived = lockedListing.price - taxAmount;

      // 2. Registrar partida doble en Ledger
      await tx.coinTransaction.create({
        data: { userId, amount: -lockedListing.price, type: "TRANSFER", referenceId: listingId },
      });
      await tx.coinTransaction.create({
        data: { userId: lockedListing.sellerId, amount: sellerNetReceived, type: "TRANSFER", referenceId: listingId },
      });
      await tx.coinTransaction.create({
        data: { systemAccountId: "SYSTEM_TAX", amount: taxAmount, type: "MARKET_TAX", referenceId: listingId },
      });

      // 3. Actualizar cachés de saldo
      await tx.user.update({
        where: { id: userId },
        data: { coins: { decrement: lockedListing.price } },
      });

      await tx.user.update({
        where: { id: lockedListing.sellerId },
        data: { coins: { increment: sellerNetReceived } },
      });

      await tx.systemAccount.update({
        where: { id: "SYSTEM_TAX" },
        data: { balance: { increment: taxAmount } },
      });

      // 4. Transferir la propiedad de la carta
      await tx.ownedPlayer.update({
        where: { id: ownedRecord.id },
        data: { userId, clause: Math.round(lockedListing.price * 1.2), protectedUntil: protectionExpiry() }
      });

      // 5. Eliminar publicación del mercado
      await tx.playerListing.delete({ where: { id: listingId } });

      // 6. Remover de la alineación del vendedor
      const squad = await tx.fantasySquad.findUnique({
        where: { userId_leagueId: { userId: lockedListing.sellerId, leagueId: lockedListing.leagueId } },
      });
      if (squad) {
        const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
        const cleaned = ids.filter((id) => id !== lockedListing.playerId);
        if (cleaned.length !== ids.length) {
          await tx.fantasySquad.update({
            where: { id: squad.id },
            data: { playerIds: cleaned.join(","), ...(squad.captainId === lockedListing.playerId ? { captainId: null } : {}) },
          });
        }
      }
    });

    res.json({ ok: true });
  } catch (e: any) {
    return res.status(409).json({ error: e.message || "No se pudo completar la compra" });
  }
});

export default router;
