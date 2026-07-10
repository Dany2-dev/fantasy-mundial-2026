import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Catálogo de competencias para el selector al crear una liga.
// Las "en temporada" (isCurrent) primero, luego por prioridad.
router.get("/", requireAuth, async (_req, res) => {
  const [competitions, started] = await Promise.all([
    prisma.competition.findMany({
      orderBy: [{ isCurrent: "desc" }, { priority: "asc" }],
      select: {
        id: true,
        name: true,
        ccode: true,
        type: true,
        logoUrl: true,
        isCurrent: true,
        _count: { select: { teams: true, players: true } },
      },
    }),
    // Una competencia "ya empezó" si tiene al menos un partido jugado o en vivo.
    prisma.match.groupBy({ by: ["competitionId"], where: { status: { in: ["live", "finished"] } } }),
  ]);
  const startedIds = new Set(started.map((s) => s.competitionId));

  res.json({
    competitions: competitions.map((c) => ({
      id: c.id,
      name: c.name,
      ccode: c.ccode,
      type: c.type,
      logoUrl: c.logoUrl,
      isCurrent: c.isCurrent,
      teamCount: c._count.teams,
      playerCount: c._count.players,
      hasStarted: startedIds.has(c.id),
    })),
  });
});

export default router;
