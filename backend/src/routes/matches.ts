import { Router } from "express";
import { prisma } from "../lib/prisma";
import { gwLabel } from "../lib/rounds";
import { requireAuth } from "../middleware/auth";
import { syncResults } from "../services/sync";

const router = Router();

function shape(m: {
  id: number;
  homeName: string;
  awayName: string;
  group: string | null;
  round: number | null;
  utcTime: Date | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { flag: string | null; logoUrl: string | null } | null;
  awayTeam: { flag: string | null; logoUrl: string | null } | null;
}) {
  return {
    id: m.id,
    home: { name: m.homeName, flag: m.homeTeam?.flag ?? null, logoUrl: m.homeTeam?.logoUrl ?? null },
    away: { name: m.awayName, flag: m.awayTeam?.flag ?? null, logoUrl: m.awayTeam?.logoUrl ?? null },
    group: m.group,
    round: m.round,
    roundLabel: m.round != null ? gwLabel(m.round) : null,
    utcTime: m.utcTime,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  };
}

const withTeams = {
  homeTeam: { select: { flag: true, logoUrl: true } },
  awayTeam: { select: { flag: true, logoUrl: true } },
} as const;

// Calendario real (opcional ?competitionId= ?status= ?round=).
router.get("/", requireAuth, async (req, res) => {
  const { status, round, competitionId } = req.query;
  const matches = await prisma.match.findMany({
    where: {
      ...(typeof competitionId === "string" && competitionId ? { competitionId: Number(competitionId) } : {}),
      ...(typeof status === "string" && status ? { status } : {}),
      ...(typeof round === "string" && round ? { round: Number(round) } : {}),
    },
    include: withTeams,
    orderBy: { utcTime: "asc" },
  });
  res.json({ matches: matches.map(shape) });
});

// Partidos en vivo ahora mismo (opcional ?competitionId=).
router.get("/live", requireAuth, async (req, res) => {
  const { competitionId } = req.query;
  const matches = await prisma.match.findMany({
    where: {
      status: "live",
      ...(typeof competitionId === "string" && competitionId ? { competitionId: Number(competitionId) } : {}),
    },
    include: withTeams,
    orderBy: { utcTime: "asc" },
  });
  res.json({ matches: matches.map(shape) });
});

// Disparo de sincronización de puntos (protegido con token para pipeline/cron).
// Header:  x-sync-token: <SYNC_TOKEN>
router.post("/sync", async (req, res) => {
  const expected = process.env.SYNC_TOKEN;
  if (!expected || req.header("x-sync-token") !== expected) {
    return res.status(401).json({ error: "Token de sincronización inválido" });
  }
  try {
    const result = await syncResults({ force: Boolean(req.body?.force) });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Sync falló" });
  }
});

export default router;
