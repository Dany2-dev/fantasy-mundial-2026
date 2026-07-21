// Seed multi-competencia: recorre el catálogo curado y scrapea de FotMob cada
// competencia (LaLiga, Liga MX, Premier, Mundial…) dejando todo ordenado:
//   Competition -> Team -> Player  +  Match  +  Gameweek
// Ejecuta:  npm run db:seed:fotmob
//   --only=77,230   limita a ciertos fotmobId
//   --keep          no borra datos previos (agrega/actualiza)
import { PrismaClient } from "@prisma/client";
import { COMPETITIONS, type CatalogEntry } from "../src/lib/catalog";
import { flagFor } from "../src/lib/flags";
import { valueFromOverall } from "../src/services/economy";
import {
  getLeague,
  getTeamSquad,
  leagueLogoUrl,
  playerPhotoUrl,
  teamLogoUrl,
  type FMSquadPlayer,
} from "../src/lib/fotmob";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const POS_MAP: Record<string, string> = { GK: "POR", DEF: "DEF", MID: "MED", FWD: "DEL" };

// Overall de carta (60-95) desde el valor de mercado de FotMob (€), escala log.
function overallFromValue(p: FMSquadPlayer): number {
  if (p.transferValue && p.transferValue > 0) {
    return clamp(Math.round(10.4 * Math.log10(p.transferValue) + 7.4), 60, 95);
  }
  if (p.avgRating && p.avgRating > 0) return clamp(Math.round(50 + p.avgRating * 4), 60, 90);
  const bias = p.position === "FWD" ? 3 : p.position === "MID" ? 2 : p.position === "GK" ? 1 : 0;
  return 64 + ((p.fotmobId % 10) + bias);
}

// Precio de carta = valor de mercado REAL de FotMob (€); si no lo publica,
// se estima con la inversa de la curva del overall (valueFromOverall).
const priceFor = (p: FMSquadPlayer, overall: number) =>
  p.transferValue && p.transferValue > 0 ? p.transferValue : valueFromOverall(overall);

async function clearAll() {
  await prisma.tradeOffer.deleteMany();
  await prisma.userGameweekScore.deleteMany();
  await prisma.playerGameweekStats.deleteMany();
  await prisma.ownedPlayer.deleteMany();
  await prisma.fantasySquad.deleteMany();
  await prisma.leagueMembership.deleteMany();
  await prisma.league.deleteMany();
  await prisma.match.deleteMany();
  await prisma.gameweek.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.competition.deleteMany();
}

async function seedCompetition(entry: CatalogEntry) {
  const isNational = entry.groupStageOnly === true; // solo el Mundial usa selecciones
  const { details, teams, matches } = await getLeague(entry.fotmobId, {
    groupStageOnly: entry.groupStageOnly,
  });
  if (teams.length === 0) {
    console.warn(`   ⚠️  ${entry.fallbackName} (${entry.fotmobId}) sin equipos, se omite.`);
    return;
  }

  const competition = await prisma.competition.upsert({
    where: { fotmobId: entry.fotmobId },
    update: {
      name: details.name || entry.fallbackName,
      ccode: details.ccode,
      type: entry.type,
      logoUrl: leagueLogoUrl(entry.fotmobId),
      priority: entry.priority,
      isCurrent: entry.isCurrent ?? false,
    },
    create: {
      fotmobId: entry.fotmobId,
      name: details.name || entry.fallbackName,
      ccode: details.ccode,
      type: entry.type,
      logoUrl: leagueLogoUrl(entry.fotmobId),
      priority: entry.priority,
      isCurrent: entry.isCurrent ?? false,
    },
  });

  // Equipos + plantillas
  const teamIdByFotmob = new Map<number, number>();
  let playerCount = 0;
  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { competitionId_fotmobId: { competitionId: competition.id, fotmobId: t.fotmobId } },
      update: { name: t.name, logoUrl: teamLogoUrl(t.fotmobId), group: t.group, flag: isNational ? flagFor(t.name) : null },
      create: {
        competitionId: competition.id,
        fotmobId: t.fotmobId,
        name: t.name,
        logoUrl: teamLogoUrl(t.fotmobId),
        group: t.group,
        flag: isNational ? flagFor(t.name) : null,
      },
    });
    teamIdByFotmob.set(t.fotmobId, team.id);

    let squad: FMSquadPlayer[] = [];
    try {
      squad = await getTeamSquad(t.fotmobId);
    } catch (e) {
      console.warn(`      ⚠️  sin plantilla ${t.name}: ${(e as Error).message}`);
    }
    if (squad.length) {
      await prisma.player.createMany({
        data: squad.map((p) => {
          const overall = overallFromValue(p);
          return {
            competitionId: competition.id,
            teamId: team.id,
            fotmobId: p.fotmobId,
            name: p.name,
            position: POS_MAP[p.position] ?? "MED",
            rating: overall,
            basePrice: priceFor(p, overall),
            photoUrl: playerPhotoUrl(p.fotmobId),
            age: p.age,
          };
        }),
        skipDuplicates: true,
      });
      playerCount += squad.length;
    }
    await sleep(250); // rate limiting cortés
  }

  // Jornadas (deadline = primer partido de cada round)
  const roundDeadline = new Map<number, Date>();
  for (const m of matches) {
    if (m.round == null || !m.utcTime) continue;
    const d = new Date(m.utcTime);
    const cur = roundDeadline.get(m.round);
    if (!cur || d < cur) roundDeadline.set(m.round, d);
  }
  const now = new Date();
  for (const [number, deadline] of roundDeadline) {
    await prisma.gameweek.upsert({
      where: { competitionId_number: { competitionId: competition.id, number } },
      update: { deadline, status: deadline < now ? "finished" : "upcoming" },
      create: { competitionId: competition.id, number, deadline, status: deadline < now ? "finished" : "upcoming" },
    });
  }

  // Fixtures
  let fx = 0;
  for (const m of matches) {
    if (!m.homeName || !m.awayName) continue;
    const status = m.finished ? "finished" : m.started ? "live" : "scheduled";
    await prisma.match.upsert({
      where: { fotmobId: m.fotmobId },
      update: { status, homeScore: m.homeScore, awayScore: m.awayScore },
      create: {
        competitionId: competition.id,
        fotmobId: m.fotmobId,
        homeTeamId: m.homeId ? teamIdByFotmob.get(m.homeId) ?? null : null,
        awayTeamId: m.awayId ? teamIdByFotmob.get(m.awayId) ?? null : null,
        homeName: m.homeName,
        awayName: m.awayName,
        group: m.group,
        round: m.round,
        utcTime: m.utcTime ? new Date(m.utcTime) : null,
        status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      },
    });
    fx++;
  }

  console.log(
    `   ✅ ${competition.name} (${details.ccode ?? "?"}) — ${teams.length} equipos, ${playerCount} jugadores, ${fx} partidos, ${roundDeadline.size} jornadas`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const keep = args.includes("--keep");
  const only = onlyArg ? onlyArg.slice(7).split(",").map(Number) : null;

  const list = COMPETITIONS.filter((c) => !only || only.includes(c.fotmobId)).sort(
    (a, b) => a.priority - b.priority
  );

  console.log(`🌍 Scrapeando ${list.length} competencia(s) de FotMob…`);
  if (!keep) {
    console.log("🧹 Limpiando datos previos…");
    await clearAll();
  }

  for (const entry of list) {
    try {
      await seedCompetition(entry);
    } catch (e) {
      console.warn(`   ⚠️  falló ${entry.fallbackName} (${entry.fotmobId}): ${(e as Error).message}`);
    }
  }

  const [comps, teams, players, matches] = await Promise.all([
    prisma.competition.count(),
    prisma.team.count(),
    prisma.player.count(),
    prisma.match.count(),
  ]);
  console.log(`\n🌱 Listo: ${comps} competencias, ${teams} equipos, ${players} jugadores, ${matches} partidos.`);
  console.log("   Siguiente:  npm run sync   (ingiere ratings reales → puntos fantasy)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
