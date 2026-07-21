import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const include = {
  fromUser: { select: { id: true, name: true } },
  toUser: { select: { id: true, name: true } },
} as const;

async function withPlayers(trades: Awaited<ReturnType<typeof prisma.tradeOffer.findMany>>) {
  const ids = [...new Set(trades.flatMap((t) => [t.offeredPlayerId, t.requestedPlayerId]))];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, include: { team: true } });
  const byId = new Map(players.map((p) => [p.id, p]));
  return trades.map((t) => ({
    ...t,
    offeredPlayer: byId.get(t.offeredPlayerId),
    requestedPlayer: byId.get(t.requestedPlayerId),
  }));
}

router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const trades = await prisma.tradeOffer.findMany({
    where: { leagueId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json({ trades: await withPlayers(trades) });
});

const offerSchema = z.object({
  leagueId: z.string().min(1),
  toUserId: z.string().min(1),
  offeredPlayerId: z.number().int(),
  requestedPlayerId: z.number().int(),
  coins: z.number().int().min(0).default(0),
});

router.post("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, toUserId, offeredPlayerId, requestedPlayerId, coins } = parsed.data;

  if (toUserId === userId) return res.status(400).json({ error: "No puedes ofertarte a ti mismo" });

  const [mine, theirs, me] = await Promise.all([
    prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId: offeredPlayerId } } }),
    prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId: requestedPlayerId } } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  if (!mine || mine.userId !== userId) return res.status(400).json({ error: "Esa carta no es tuya en esta liga" });
  if (!theirs || theirs.userId !== toUserId) return res.status(400).json({ error: "El otro mánager ya no tiene esa carta" });
  if (me.coins < coins) return res.status(400).json({ error: "No tienes esas monedas" });

  const trade = await prisma.tradeOffer.create({
    data: { leagueId, fromUserId: userId, toUserId, offeredPlayerId, requestedPlayerId, coins },
    include,
  });
  res.status(201).json({ trade: (await withPlayers([trade]))[0] });
});

router.post("/:id/respond", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const accept = Boolean(req.body?.accept);
  const tradeId = req.params.id;

  const initialTrade = await prisma.tradeOffer.findUnique({ where: { id: tradeId } });
  if (!initialTrade) return res.status(404).json({ error: "Oferta no encontrada" });
  if (initialTrade.toUserId !== userId) return res.status(403).json({ error: "Esta oferta no es para ti" });
  if (initialTrade.status !== "pending") return res.status(409).json({ error: "La oferta ya fue respondida" });

  if (!accept) {
    await prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: "rejected" } });
    return res.json({ ok: true, status: "rejected" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // REGLA DE LOCKING 1: Bloquear Users de forma ordenada alfabéticamente
      const sortedUserIds = [initialTrade.fromUserId, initialTrade.toUserId].sort();
      for (const uid of sortedUserIds) {
        await tx.$queryRaw`
          SELECT id, coins FROM "User" WHERE id = ${uid} FOR UPDATE
        `;
      }

      // REGLA DE LOCKING 2: Bloquear OwnedPlayers (O antes que T).
      // Se ordenan los IDs de jugadores numéricamente (playerId es Int) para evitar deadlocks físicos.
      const playerIdsToLock = [initialTrade.offeredPlayerId, initialTrade.requestedPlayerId].sort((a, b) => a - b);
      
      const ownedRows = await tx.$queryRaw<any[]>`
        SELECT id, "userId", "playerId" FROM "OwnedPlayer" 
        WHERE "leagueId" = ${initialTrade.leagueId} 
          AND "playerId" IN (${playerIdsToLock[0]}, ${playerIdsToLock[1]})
        ORDER BY "playerId" ASC
        FOR UPDATE
      `;

      const lockedOffered = ownedRows.find(r => r.playerId === initialTrade.offeredPlayerId);
      const lockedRequested = ownedRows.find(r => r.playerId === initialTrade.requestedPlayerId);

      // Re-verificar la propiedad legítima de las cartas bajo lock
      if (!lockedOffered || lockedOffered.userId !== initialTrade.fromUserId) {
        await tx.tradeOffer.update({ where: { id: tradeId }, data: { status: "rejected" } });
        throw new Error("El proponente ya no posee la carta ofrecida. Intercambio cancelado.");
      }

      if (!lockedRequested || lockedRequested.userId !== initialTrade.toUserId) {
        await tx.tradeOffer.update({ where: { id: tradeId }, data: { status: "rejected" } });
        throw new Error("Ya no posees la carta solicitada. Intercambio cancelado.");
      }

      // REGLA DE LOCKING 3: Bloquear y leer TradeOffer (T después de O)
      const trades = await tx.$queryRaw<any[]>`
        SELECT id, status, coins, "offeredPlayerId", "requestedPlayerId", "fromUserId", "toUserId", "leagueId"
        FROM "TradeOffer" WHERE id = ${tradeId} FOR UPDATE
      `;
      const lockedTrade = trades[0];
      if (!lockedTrade || lockedTrade.status !== "pending") {
        throw new Error("La oferta cambió de estado.");
      }

      // 1. Transferencia de monedas (Si hay monedas de por medio)
      if (lockedTrade.coins > 0) {
        const offerer = await tx.user.findUnique({ where: { id: lockedTrade.fromUserId }, select: { coins: true } });
        if (!offerer || offerer.coins < lockedTrade.coins) {
          throw new Error("El proponente ya no cuenta con monedas suficientes.");
        }

        // Registrar transacciones contables en el Ledger
        await tx.coinTransaction.create({
          data: { userId: lockedTrade.fromUserId, amount: -lockedTrade.coins, type: "TRANSFER", referenceId: tradeId },
        });
        await tx.coinTransaction.create({
          data: { userId: lockedTrade.toUserId, amount: lockedTrade.coins, type: "TRANSFER", referenceId: tradeId },
        });

        // Actualizar cachés de saldo
        await tx.user.update({
          where: { id: lockedTrade.fromUserId },
          data: { coins: { decrement: lockedTrade.coins } },
        });
        await tx.user.update({
          where: { id: lockedTrade.toUserId },
          data: { coins: { increment: lockedTrade.coins } },
        });
      }

      // 2. Transferir la propiedad de las cartas en OwnedPlayer
      await tx.ownedPlayer.update({
        where: { id: lockedOffered.id },
        data: { userId: lockedTrade.toUserId }
      });

      await tx.ownedPlayer.update({
        where: { id: lockedRequested.id },
        data: { userId: lockedTrade.fromUserId }
      });

      // 3. Confirmar la aceptación de la oferta
      await tx.tradeOffer.update({
        where: { id: tradeId },
        data: { status: "accepted" }
      });

      // 4. Cancelar/Rechazar de forma automática cualquier otra oferta pendiente que involucre a cualquiera de estas cartas
      await tx.tradeOffer.updateMany({
        where: {
          id: { not: tradeId },
          leagueId: lockedTrade.leagueId,
          status: "pending",
          OR: [
            { offeredPlayerId: lockedTrade.offeredPlayerId },
            { offeredPlayerId: lockedTrade.requestedPlayerId },
            { requestedPlayerId: lockedTrade.offeredPlayerId },
            { requestedPlayerId: lockedTrade.requestedPlayerId }
          ]
        },
        data: { status: "rejected" }
      });

      // 5. Remover las cartas intercambiadas de las alineaciones de ambos managers
      const squads = await tx.fantasySquad.findMany({
        where: { leagueId: lockedTrade.leagueId, userId: { in: [lockedTrade.fromUserId, lockedTrade.toUserId] } },
      });
      for (const squad of squads) {
        const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
        const cleaned = ids.filter((id) => id !== lockedTrade.offeredPlayerId && id !== lockedTrade.requestedPlayerId);
        if (cleaned.length !== ids.length) {
          const captainOut = squad.captainId === lockedTrade.offeredPlayerId || squad.captainId === lockedTrade.requestedPlayerId;
          await tx.fantasySquad.update({
            where: { id: squad.id },
            data: { playerIds: cleaned.join(","), ...(captainOut ? { captainId: null } : {}) },
          });
        }
      }
    });
  } catch (e: any) {
    return res.status(409).json({ error: e.message || "No se pudo completar el intercambio" });
  }

  res.json({ ok: true, status: "accepted" });
});

export default router;
