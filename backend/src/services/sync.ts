// Ingesta de resultados reales: descarga el detalle de cada partido de FotMob,
// convierte ratings/goles/asistencias a puntos fantasy (PlayerGameweekStats) y
// recalcula la puntuación de cada mánager por jornada (UserGameweekScore).
import { PrismaClient } from "@prisma/client";
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

// Refresca marcadores/estado desde el calendario (barato, una sola petición).
async function refreshFixtures(): Promise<number> {
  const { matches } = await getLeague();
  let updated = 0;
  for (const m of matches) {
    const status = m.finished ? "finished" : m.started ? "live" : "scheduled";
    const res = await prisma.match.updateMany({
      where: { fotmobId: m.fotmobId },
      data: { status, homeScore: m.homeScore, awayScore: m.awayScore },
    });
    updated += res.count;
  }
  return updated;
}

// Ingesta de detalle (ratings/goles) para partidos jugados aún no sincronizados.
export async function syncResults(opts: { limit?: number; force?: boolean } = {}): Promise<SyncResult> {
  const { limit = 40, force = false } = opts;

  const matchesUpdated = await refreshFixtures();

  const pending = await prisma.match.findMany({
    where: {
      status: { in: force ? ["finished", "live"] : ["finished", "live"] },
      round: { not: null },
      ...(force ? {} : { detailsSyncedAt: null }),
    },
    orderBy: { utcTime: "asc" },
    take: limit,
  });

  // fotmobId de jugador -> {id, position} para cruzar el detalle con nuestra BD.
  const players = await prisma.player.findMany({
    where: { fotmobId: { not: null } },
    select: { id: true, fotmobId: true, position: true },
  });
  const byFotmob = new Map(players.map((p) => [p.fotmobId!, p]));

  const gameweeks = await prisma.gameweek.findMany({ select: { id: true, number: true } });
  const gwByNumber = new Map(gameweeks.map((g) => [g.number, g.id]));

  let statsUpserted = 0;
  let matchesSynced = 0;
  const touchedGwIds = new Set<number>();

  for (const match of pending) {
    const gwId = match.round != null ? gwByNumber.get(match.round) : undefined;
    if (!gwId) continue;
    try {
      const detail = await getMatchDetails(match.fotmobId);
      const playerIds = new Set<number>([
        ...Object.keys(detail.ratings),
        ...Object.keys(detail.goals),
        ...Object.keys(detail.assists),
      ].map(Number));

      for (const fmId of playerIds) {
        const p = byFotmob.get(fmId);
        if (!p) continue; // jugador no está en nuestra BD (p.ej. no convocado en el seed)
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
          create: {
            playerId: p.id,
            gameweekId: gwId,
            goals: detail.goals[fmId] ?? 0,
            assists: detail.assists[fmId] ?? 0,
            points,
          },
        });
        statsUpserted++;
      }

      await prisma.match.update({
        where: { id: match.id },
        data: { detailsSyncedAt: new Date() },
      });
      touchedGwIds.add(gwId);
      matchesSynced++;
      await sleep(400); // rate limiting cortés con FotMob
    } catch (e) {
      console.warn(`   ⚠️  detalle falló para partido ${match.fotmobId}: ${(e as Error).message}`);
    }
  }

  const scoresUpdated = await recomputeScores([...touchedGwIds]);
  return { matchesUpdated, matchesSynced, statsUpserted, scoresUpdated };
}

// Recalcula UserGameweekScore para las jornadas indicadas (o todas con stats).
export async function recomputeScores(gameweekIds?: number[]): Promise<number> {
  const gwIds =
    gameweekIds && gameweekIds.length
      ? gameweekIds
      : (await prisma.playerGameweekStats.findMany({ distinct: ["gameweekId"], select: { gameweekId: true } })).map(
          (r) => r.gameweekId
        );
  if (gwIds.length === 0) return 0;

  const memberships = await prisma.leagueMembership.findMany({ select: { userId: true, leagueId: true } });
  const squads = await prisma.fantasySquad.findMany();
  const squadKey = (u: string, l: string) => `${u}::${l}`;
  const squadMap = new Map(squads.map((s) => [squadKey(s.userId, s.leagueId), s]));

  let updated = 0;
  for (const gwId of gwIds) {
    const stats = await prisma.playerGameweekStats.findMany({
      where: { gameweekId: gwId },
      select: { playerId: true, points: true },
    });
    const ptsByPlayer = new Map(stats.map((s) => [s.playerId, s.points]));

    for (const m of memberships) {
      const squad = squadMap.get(squadKey(m.userId, m.leagueId));
      if (!squad) continue;
      const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
      let total = 0;
      for (const pid of ids) {
        const base = ptsByPlayer.get(pid) ?? 0;
        total += squad.captainId === pid ? base * 2 : base; // capitán x2
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
