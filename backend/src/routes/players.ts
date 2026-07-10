import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Equipos de una competencia (para filtros del front).
router.get("/teams", requireAuth, async (req, res) => {
  const competitionId = Number(req.query.competitionId);
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });
  const teams = await prisma.team.findMany({
    where: { competitionId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, logoUrl: true, flag: true, group: true },
  });
  res.json({ teams });
});

// Jugadores de una competencia (con filtros).
router.get("/players", requireAuth, async (req, res) => {
  const { search, position, teamId, competitionId } = req.query;
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });
  const players = await prisma.player.findMany({
    where: {
      competitionId: Number(competitionId),
      ...(typeof search === "string" && search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(typeof position === "string" && position ? { position } : {}),
      ...(typeof teamId === "string" && teamId ? { teamId: Number(teamId) } : {}),
    },
    include: { team: { select: { id: true, name: true, logoUrl: true, flag: true } } },
    orderBy: { rating: "desc" },
  });
  res.json({ players });
});

export default router;
