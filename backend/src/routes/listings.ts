import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { protectionExpiry } from "../services/economy";

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
  const listing = await prisma.playerListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: "Publicación no encontrada" });
  if (listing.sellerId === userId) return res.status(400).json({ error: "No puedes comprarte tu propia carta" });

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (buyer.coins < listing.price) return res.status(400).json({ error: "No tienes esas monedas" });

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.playerListing.findUnique({ where: { id: listing.id } });
      if (!fresh) throw new Error("Esa publicación ya no existe");
      const owned = await tx.ownedPlayer.findUnique({
        where: { leagueId_playerId: { leagueId: fresh.leagueId, playerId: fresh.playerId } },
      });
      if (!owned || owned.userId !== fresh.sellerId) throw new Error("El jugador ya cambió de dueño");

      await tx.user.update({ where: { id: userId }, data: { coins: { decrement: fresh.price } } });
      await tx.user.update({ where: { id: fresh.sellerId }, data: { coins: { increment: fresh.price } } });
      await tx.ownedPlayer.update({
        where: { id: owned.id },
        data: { userId, clause: Math.round(fresh.price * 1.2), protectedUntil: protectionExpiry() },
      });
      await tx.playerListing.delete({ where: { id: fresh.id } });

      const squad = await tx.fantasySquad.findUnique({
        where: { userId_leagueId: { userId: fresh.sellerId, leagueId: fresh.leagueId } },
      });
      if (squad) {
        const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
        const cleaned = ids.filter((id) => id !== fresh.playerId);
        if (cleaned.length !== ids.length) {
          await tx.fantasySquad.update({
            where: { id: squad.id },
            data: { playerIds: cleaned.join(","), ...(squad.captainId === fresh.playerId ? { captainId: null } : {}) },
          });
        }
      }
    });
  } catch (e) {
    return res.status(409).json({ error: e instanceof Error ? e.message : "No se pudo completar la compra" });
  }

  res.json({ ok: true });
});

export default router;
