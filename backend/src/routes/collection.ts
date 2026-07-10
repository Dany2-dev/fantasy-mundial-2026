import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Mi colección en una liga (con cláusula y protección de cada carta)
router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const [owned, listings] = await Promise.all([
    prisma.ownedPlayer.findMany({
      where: { userId, leagueId },
      include: { player: { include: { team: true } } },
      orderBy: { player: { rating: "desc" } },
    }),
    prisma.playerListing.findMany({ where: { leagueId, sellerId: userId }, select: { playerId: true, price: true } }),
  ]);
  const listedByPlayer = new Map(listings.map((l) => [l.playerId, l.price]));
  const now = new Date();

  res.json({
    collection: owned.map((o) => ({
      ownedId: o.id,
      acquiredAt: o.acquiredAt,
      clause: o.clause,
      protectedUntil: o.protectedUntil,
      isProtected: Boolean(o.protectedUntil && o.protectedUntil > now),
      listedPrice: listedByPlayer.get(o.playerId) ?? null,
      ...o.player,
    })),
  });
});

// Cartas de los demás mánagers de la liga (para el mercado: intercambio y clausulazo)
router.get("/market", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const owned = await prisma.ownedPlayer.findMany({
    where: { leagueId, NOT: { userId } },
    include: {
      player: { include: { team: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { player: { rating: "desc" } },
  });
  const now = new Date();
  res.json({
    market: owned.map((o) => ({
      owner: o.user,
      clause: o.clause,
      isProtected: Boolean(o.protectedUntil && o.protectedUntil > now),
      protectedUntil: o.protectedUntil,
      ...o.player,
    })),
  });
});

export default router;
