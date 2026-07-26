import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Catálogo de competencias para el selector al crear una liga.
// Las "en temporada" (isCurrent) primero, luego por prioridad.
router.get("/", requireAuth, async (_req, res) => {
  const [competitions, started, pending] = await Promise.all([
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
    // …y sigue viva mientras le quede algún partido por jugarse.
    prisma.match.groupBy({ by: ["competitionId"], where: { status: { notIn: ["finished"] } } }),
  ]);
  const startedIds = new Set(started.map((s) => s.competitionId));
  const pendingIds = new Set(pending.map((s) => s.competitionId));

  res.json({
    // Una competencia que empezó y ya no tiene partidos pendientes terminó: no
    // tiene sentido ofrecerla para crear una liga nueva (el caso del Mundial,
    // que acabó en julio de 2026). Las que aún no cargaron fixture se quedan.
    competitions: competitions
      .filter((c) => !(startedIds.has(c.id) && !pendingIds.has(c.id)))
      .map((c) => ({
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
