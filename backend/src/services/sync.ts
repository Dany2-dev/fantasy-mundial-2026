// Ingesta de resultados reales por competencia: descarga el detalle de cada
// partido de FotMob, convierte ratings/goles/asistencias a puntos fantasy
// (PlayerGameweekStats) y recalcula la puntuación de cada mánager (UserGameweekScore).
import { PrismaClient } from "@prisma/client";
import { COMPETITIONS } from "../lib/catalog";
import { getLeague, getMatchDetails } from "../lib/fotmob";
import { COINS_PER_POINT } from "./economy";
import { computePoints } from "./points";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SyncResult {
  matchesUpdated: number;
  matchesSynced: number;
  statsUpserted: number;
  scoresUpdated: number;
  gameweeksClosed: number;
  rewardsPaid: number;
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

// Solo marcador/estado (1 request por competencia, sin detalle de partido) —
// pensado para correr seguido y mantener el marcador al día sin pagar el
// costo del sync completo (que sí pega un request por partido a sincronizar).
export async function refreshScoreboards(competitionId?: number): Promise<number> {
  const comps = await prisma.competition.findMany({
    where: competitionId ? { id: competitionId } : undefined,
    select: { fotmobId: true },
  });
  return refreshFixtures(comps.map((c) => c.fotmobId));
}

export async function syncResults(
  opts: { limit?: number; force?: boolean; competitionId?: number } = {}
): Promise<SyncResult> {
  const { limit = 60, force = false, competitionId } = opts;

  const matchesUpdated = await refreshScoreboards(competitionId);

  const pending = await prisma.match.findMany({
    where: {
      status: { in: ["finished", "live"] },
      round: { not: null },
      ...(competitionId ? { competitionId } : {}),
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
  const gameweeksClosed = await closeFinishedGameweeks(competitionId);
  const rewardsPaid = await payGameweekRewards();
  return { matchesUpdated, matchesSynced, statsUpserted, scoresUpdated, gameweeksClosed, rewardsPaid };
}

// Cierra jornadas cuyo deadline ya pasó y cuyos partidos ya terminaron todos.
// (El seed las crea "upcoming" y nada más las transicionaba — sin esto el
// Historial nunca listaba jornadas y no había momento de pagar premios.)
export async function closeFinishedGameweeks(competitionId?: number): Promise<number> {
  const now = new Date();
  const open = await prisma.gameweek.findMany({
    where: { status: "upcoming", deadline: { lt: now }, ...(competitionId ? { competitionId } : {}) },
  });
  let closed = 0;
  for (const gw of open) {
    const unfinished = await prisma.match.count({
      where: { competitionId: gw.competitionId, round: gw.number, status: { not: "finished" } },
    });
    const total = await prisma.match.count({ where: { competitionId: gw.competitionId, round: gw.number } });
    if (total > 0 && unfinished === 0) {
      await prisma.gameweek.update({ where: { id: gw.id }, data: { status: "finished" } });
      closed++;
    }
  }
  return closed;
}

// Ingreso de la economía: al cerrar una jornada, cada mánager cobra
// COINS_PER_POINT por punto de su once esa jornada (una sola vez, paidOut).
// El premio se abona al presupuesto de ESA liga (LeagueMembership), no a un
// saldo global — cada liga es una economía cerrada.
export async function payGameweekRewards(): Promise<number> {
  const due = await prisma.userGameweekScore.findMany({
    where: { paidOut: false, gameweek: { status: "finished" } },
  });
  for (const s of due) {
    await prisma.$transaction([
      // updateMany: si el mánager dejó la liga (membresía borrada), no truena;
      // el score igual se marca pagado para no reintentarlo por siempre.
      prisma.leagueMembership.updateMany({
        where: { userId: s.userId, leagueId: s.leagueId },
        data: { coins: { increment: s.points * COINS_PER_POINT } },
      }),
      prisma.userGameweekScore.update({ where: { id: s.id }, data: { paidOut: true } }),
    ]);
  }
  return due.length;
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
