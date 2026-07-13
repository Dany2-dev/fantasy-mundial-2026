import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Grupos válidos de fase de grupos (excluye repechaje/otras rondas).
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

interface StandingRow {
  teamId: number;
  name: string;
  flag: string | null;
  logoUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

// Tabla general por grupo, calculada desde los partidos finished en BD (sin FotMob).
router.get("/standings", requireAuth, async (req, res) => {
  const competitionId = Number(req.query.competitionId);
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });

  const teams = await prisma.team.findMany({
    where: { competitionId, group: { in: GROUPS } },
    select: { id: true, name: true, flag: true, logoUrl: true, group: true },
  });

  const rowsByTeam = new Map<number, StandingRow & { group: string }>();
  for (const t of teams) {
    rowsByTeam.set(t.id, {
      teamId: t.id,
      name: t.name,
      flag: t.flag,
      logoUrl: t.logoUrl,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      group: t.group as string,
    });
  }

  const matches = await prisma.match.findMany({
    where: {
      competitionId,
      status: "finished",
      group: { in: GROUPS },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  for (const m of matches) {
    if (m.homeTeamId == null || m.awayTeamId == null || m.homeScore == null || m.awayScore == null) continue;
    const home = rowsByTeam.get(m.homeTeamId);
    const away = rowsByTeam.get(m.awayTeamId);
    if (!home || !away) continue; // equipo fuera de la fase de grupos (p. ej. repechaje)

    home.played++;
    away.played++;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (m.homeScore < m.awayScore) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const r of rowsByTeam.values()) r.goalDiff = r.goalsFor - r.goalsAgainst;

  const groupsMap = new Map<string, StandingRow[]>();
  for (const { group, ...row } of rowsByTeam.values()) {
    if (!groupsMap.has(group)) groupsMap.set(group, []);
    groupsMap.get(group)!.push(row);
  }

  const groups = [...groupsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => ({
      group,
      rows: rows.sort(
        (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name)
      ),
    }));

  res.json({ groups });
});

interface ScorerRow {
  playerId: number;
  name: string;
  photoUrl: string | null;
  position: string;
  teamId: number;
  teamName: string;
  teamFlag: string | null;
  teamLogo: string | null;
  goals: number;
  assists: number;
}

// Tabla de goleadores/asistentes, sumando PlayerGameweekStats de la competencia.
router.get("/scorers", requireAuth, async (req, res) => {
  const competitionId = Number(req.query.competitionId);
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.trunc(limitRaw), 30) : 10;

  const stats = await prisma.playerGameweekStats.findMany({
    where: { player: { competitionId } },
    select: {
      goals: true,
      assists: true,
      player: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          position: true,
          teamId: true,
          team: { select: { name: true, flag: true, logoUrl: true } },
        },
      },
    },
  });

  const byPlayer = new Map<number, ScorerRow>();
  for (const s of stats) {
    const p = s.player;
    let row = byPlayer.get(p.id);
    if (!row) {
      row = {
        playerId: p.id,
        name: p.name,
        photoUrl: p.photoUrl,
        position: p.position,
        teamId: p.teamId,
        teamName: p.team?.name ?? "",
        teamFlag: p.team?.flag ?? null,
        teamLogo: p.team?.logoUrl ?? null,
        goals: 0,
        assists: 0,
      };
      byPlayer.set(p.id, row);
    }
    row.goals += s.goals;
    row.assists += s.assists;
  }

  const scorers = [...byPlayer.values()]
    .filter((r) => r.goals > 0 || r.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
    .slice(0, limit);

  res.json({ scorers });
});

export default router;
