import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Mi colección en una liga
router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const owned = await prisma.ownedPlayer.findMany({
    where: { userId, leagueId },
    include: { player: { include: { team: true } } },
    orderBy: { player: { rating: "desc" } },
  });
  res.json({ collection: owned.map((o) => ({ ownedId: o.id, acquiredAt: o.acquiredAt, ...o.player })) });
});

// Cartas de los demás mánagers de la liga (para el mercado)
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
  res.json({
    market: owned.map((o) => ({ owner: o.user, ...o.player })),
  });
});

export default router;
