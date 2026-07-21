import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { gwLabel } from "../lib/rounds";

const router = Router();
router.use(requireAuth);

export const FORMATIONS = ["4-4-2", "4-3-3", "3-5-2"] as const;

// No se puede editar la plantilla entre 1h antes y 1h después del primer
// partido de una jornada (Gameweek.deadline ya ES ese primer kickoff, ver
// prisma/seed-competitions.ts). Fuera de esa ventana sí se puede guardar
// siempre: lo que cambia es a qué jornada "aplica" el cambio, y eso lo
// decide recomputeScores() en services/sync.ts a partir del historial.
const LOCK_WINDOW_MS = 60 * 60 * 1000;

router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const squad = await prisma.fantasySquad.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  res.json({
    squad: squad
      ? {
          formation: squad.formation,
          playerIds: squad.playerIds ? squad.playerIds.split(",").map(Number) : [],
          captainId: squad.captainId,
        }
      : { formation: "4-4-2", playerIds: [], captainId: null },
  });
});

const saveSchema = z.object({
  leagueId: z.string().min(1),
  formation: z.enum(FORMATIONS),
  playerIds: z.array(z.number().int()).max(11, "Máximo 11 jugadores"),
  captainId: z.number().int().nullable(),
});

router.put("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, formation, playerIds, captainId } = parsed.data;

  const unique = new Set(playerIds);
  if (unique.size !== playerIds.length) {
    return res.status(400).json({ error: "Hay jugadores repetidos en el once" });
  }
  if (captainId !== null && !unique.has(captainId)) {
    return res.status(400).json({ error: "El capitán debe estar en el once" });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { competitionId: true } });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });

  const now = new Date();
  const lockedGw = await prisma.gameweek.findFirst({
    where: {
      competitionId: league.competitionId,
      deadline: { gte: new Date(now.getTime() - LOCK_WINDOW_MS), lte: new Date(now.getTime() + LOCK_WINDOW_MS) },
    },
  });
  if (lockedGw) {
    const reopensAt = new Date(lockedGw.deadline.getTime() + LOCK_WINDOW_MS);
    return res.status(400).json({
      error: `No puedes editar tu plantilla entre 1 hora antes y 1 hora después del primer partido de esta jornada (${gwLabel(
        lockedGw.number
      )}). Se reabre a las ${reopensAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`,
    });
  }

  // Solo puedes alinear cartas que posees en ESTA liga.
  const owned = await prisma.ownedPlayer.findMany({
    where: { userId, leagueId, playerId: { in: playerIds } },
    select: { playerId: true },
  });
  if (owned.length !== playerIds.length) {
    return res.status(400).json({ error: "Solo puedes alinear cartas de tu colección" });
  }

  const squad = await prisma.fantasySquad.upsert({
    where: { userId_leagueId: { userId, leagueId } },
    update: { formation, playerIds: playerIds.join(","), captainId },
    create: { userId, leagueId, formation, playerIds: playerIds.join(","), captainId },
  });
  // Cada guardado queda registrado además en el historial: recomputeScores()
  // lo usa para saber qué alineación estaba vigente al deadline de cada
  // jornada, en vez de aplicar retroactivamente la plantilla actual a todas.
  await prisma.fantasySquadHistory.create({
    data: { userId, leagueId, formation, playerIds: playerIds.join(","), captainId },
  });
  res.json({ squad: { formation: squad.formation, playerIds, captainId } });
});

export default router;
