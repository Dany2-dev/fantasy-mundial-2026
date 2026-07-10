// Ingesta de resultados reales por competencia: descarga el detalle de cada
// partido de FotMob, convierte ratings/goles/asistencias a puntos fantasy
// (PlayerGameweekStats) y recalcula la puntuación de cada mánager (UserGameweekScore).
import { PrismaClient } from "@prisma/client";
import { COMPETITIONS } from "../lib/catalog";
import { getLeague, getMatchDetails } from "../lib/fotmob";
import { computePoints } from "./points";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SyncResult {
  matchesUpdated: number;
  matchesSynced: number;
  statsUpserted: number;
  scoresUpdated: number;
}

const groupStageById = new Map(COMPETITIONS.map((c) => [c.fotmobId, c.groupStageOnly === true]));

// Refresca marcadores/estado de las competencias en BD desde el calendario.
async function refreshFixtures(competitionFotmobIds: number[]): Promise<number> {
  let updated = 0;
  for (const fid of competitionFotmobIds) {
    try {
      const { matches } = await getLeague(fid, { groupStageOnly: groupStageById.get(fid) });
      for (const m of matches) {
        const status = m.finished ? "finished" : m.started ? "live" : "scheduled";
        const res = await prisma.match.updateMany({
          where: { fotmobId: m.fotmobId },
          data: { status, homeScore: m.homeScore, awayScore: m.awayScore },
        });
        updated += res.count;
      }
    } catch (e) {
      console.warn(`   ⚠️  refresh falló para competencia ${fid}: ${(e as Error).message}`);
    }
  }
  return updated;
}

export async function syncResults(opts: { limit?: number; force?: boolean } = {}): Promise<SyncResult> {
  const { limit = 60, force = false } = opts;

  // Solo refrescamos/sincronizamos competencias que existen en BD.
  const comps = await prisma.competition.findMany({ select: { id: true, fotmobId: true } });
  const matchesUpdated = await refreshFixtures(comps.map((c) => c.fotmobId));

  const pending = await prisma.match.findMany({
    where: {
      status: { in: ["finished", "live"] },
      round: { not: null },
      ...(force ? {} : { detailsSyncedAt: null }),
    },
    orderBy: { utcTime: "asc" },
    take: limit,
  });

  // Índice jugador (competitionId+fotmobId) -> {id, position}
  const players = await prisma.player.findMany({ select: { id: true, fotmobId: true, position: true, competitionId: true } });
  const playerKey = (comp: number, fm: number) => `${comp}:${fm}`;
  const byKey = new Map(players.map((p) => [playerKey(p.competitionId, p.fotmobId), p]));

  // Índice jornada (competitionId+number) -> id
  const gameweeks = await prisma.gameweek.findMany({ select: { id: true, number: true, competitionId: true } });
  const gwKey = (comp: number, n: number) => `${comp}:${n}`;
  const gwByKey = new Map(gameweeks.map((g) => [gwKey(g.competitionId, g.number), g.id]));

  let statsUpserted = 0;
  let matchesSynced = 0;

  for (const match of pending) {
    const gwId = match.round != null ? gwByKey.get(gwKey(match.competitionId, match.round)) : undefined;
    if (!gwId) continue;
    try {
      const detail = await getMatchDetails(match.fotmobId);
      const ids = new Set<number>(
        [...Object.keys(detail.ratings), ...Object.keys(detail.goals), ...Object.keys(detail.assists)].map(Number)
      );
      for (const fmId of ids) {
        const p = byKey.get(playerKey(match.competitionId, fmId));
        if (!p) continue;
        const points = computePoints({
          position: p.position,
          rating: detail.ratings[fmId] ?? null,
          goals: detail.goals[fmId] ?? 0,
          assists: detail.assists[fmId] ?? 0,
          minutes: detail.minutes[fmId] ?? 0,
        });
        await prisma.playerGameweekStats.upsert({
          where: { playerId_gameweekId: { playerId: p.id, gameweekId: gwId } },
          update: { goals: detail.goals[fmId] ?? 0, assists: detail.assists[fmId] ?? 0, points },
          create: { playerId: p.id, gameweekId: gwId, goals: detail.goals[fmId] ?? 0, assists: detail.assists[fmId] ?? 0, points },
        });
        statsUpserted++;
      }
      await prisma.match.update({ where: { id: match.id }, data: { detailsSyncedAt: new Date() } });
      matchesSynced++;
      await sleep(400);
    } catch (e) {
      console.warn(`   ⚠️  detalle falló para partido ${match.fotmobId}: ${(e as Error).message}`);
    }
  }

  const scoresUpdated = await recomputeScores();
  return { matchesUpdated, matchesSynced, statsUpserted, scoresUpdated };
}

// Recalcula UserGameweekScore: por cada liga (atada a su competencia) suma los
// puntos del once de cada mánager en cada jornada de esa competencia (capitán x2).
export async function recomputeScores(): Promise<number> {
  const leagues = await prisma.league.findMany({ select: { id: true, competitionId: true } });
  const memberships = await prisma.leagueMembership.findMany({ select: { userId: true, leagueId: true } });
  const squads = await prisma.fantasySquad.findMany();
  const squadKey = (u: string, l: string) => `${u}::${l}`;
  const squadMap = new Map(squads.map((s) => [squadKey(s.userId, s.leagueId), s]));
  const leagueComp = new Map(leagues.map((l) => [l.id, l.competitionId]));

  // Puntos por (gameweekId -> Map(playerId -> points))  y  jornadas por competencia
  const gameweeks = await prisma.gameweek.findMany({ select: { id: true, competitionId: true } });
  const gwsByComp = new Map<number, number[]>();
  for (const g of gameweeks) gwsByComp.set(g.competitionId, [...(gwsByComp.get(g.competitionId) ?? []), g.id]);

  const allStats = await prisma.playerGameweekStats.findMany({ select: { gameweekId: true, playerId: true, points: true } });
  const ptsByGw = new Map<number, Map<number, number>>();
  for (const s of allStats) {
    if (!ptsByGw.has(s.gameweekId)) ptsByGw.set(s.gameweekId, new Map());
    ptsByGw.get(s.gameweekId)!.set(s.playerId, s.points);
  }

  let updated = 0;
  for (const m of memberships) {
    const compId = leagueComp.get(m.leagueId);
    if (compId == null) continue;
    const squad = squadMap.get(squadKey(m.userId, m.leagueId));
    if (!squad) continue;
    const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
    for (const gwId of gwsByComp.get(compId) ?? []) {
      const pts = ptsByGw.get(gwId);
      if (!pts) continue;
      let total = 0;
      for (const pid of ids) {
        const base = pts.get(pid) ?? 0;
        total += squad.captainId === pid ? base * 2 : base;
      }
      await prisma.userGameweekScore.upsert({
        where: { userId_leagueId_gameweekId: { userId: m.userId, leagueId: m.leagueId, gameweekId: gwId } },
        update: { points: total },
        create: { userId: m.userId, leagueId: m.leagueId, gameweekId: gwId, points: total },
      });
      updated++;
    }
  }
  return updated;
}

export { prisma as syncPrisma };
