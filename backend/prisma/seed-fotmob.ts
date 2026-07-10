// Seed con datos REALES del Mundial 2026 desde FotMob:
//   - Selecciones (con id de FotMob, escudo y bandera).
//   - Plantillas reales (nombre, posición, edad, dorsal, FOTO real).
//   - rating de carta (60-95) derivado del valor de mercado de FotMob.
//   - Fixtures reales (Match) + jornadas (Gameweek) con deadline real.
// Ejecuta:  npm run db:seed:fotmob
import { PrismaClient } from "@prisma/client";
import { flagFor } from "../src/lib/flags";
import { getLeague, getTeamSquad, playerPhotoUrl, teamLogoUrl, type FMSquadPlayer } from "../src/lib/fotmob";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// FotMob usa GK/DEF/MID/FWD; nuestra app usa POR/DEF/MED/DEL.
const POS_MAP: Record<string, string> = { GK: "POR", DEF: "DEF", MID: "MED", FWD: "DEL" };

// Overall de carta (60-95) desde el valor de mercado de FotMob (€).
// Escala logarítmica: €200M ≈ 94, €50M ≈ 88, €10M ≈ 80, €1M ≈ 70, <€100k ≈ 62.
function overallFromValue(p: FMSquadPlayer): number {
  if (p.transferValue && p.transferValue > 0) {
    return clamp(Math.round(10.4 * Math.log10(p.transferValue) + 7.4), 60, 95);
  }
  if (p.avgRating && p.avgRating > 0) return clamp(Math.round(50 + p.avgRating * 4), 60, 90);
  const bias = p.position === "FWD" ? 3 : p.position === "MID" ? 2 : p.position === "GK" ? 1 : 0;
  return 64 + ((p.fotmobId % 10) + bias);
}
const priceFromOverall = (o: number) => Math.max(50, Math.round(Math.pow(o - 50, 2) * 0.9));

async function clearGameData() {
  // Orden seguro por claves foráneas. Conserva usuarios, ligas y membresías.
  await prisma.tradeOffer.deleteMany();
  await prisma.userGameweekScore.deleteMany();
  await prisma.playerGameweekStats.deleteMany();
  await prisma.ownedPlayer.deleteMany();
  await prisma.fantasySquad.deleteMany();
  await prisma.match.deleteMany();
  await prisma.gameweek.deleteMany();
  await prisma.player.deleteMany();
  await prisma.country.deleteMany();
}

async function main() {
  console.log("🌍 Descargando liga (selecciones + calendario) de FotMob…");
  const { teams, matches } = await getLeague();
  console.log(`   selecciones=${teams.length}  partidos=${matches.length}`);
  if (teams.length === 0) throw new Error("FotMob no devolvió selecciones (¿grupos aún sin sorteo?).");

  console.log("🧹 Limpiando jugadores/cartas/fixtures previos…");
  await clearGameData();

  // 1) Selecciones + plantillas reales
  const countryByFotmob = new Map<number, number>(); // fotmobTeamId -> country.id
  let totalPlayers = 0;
  for (const t of teams) {
    let squad: FMSquadPlayer[];
    try {
      squad = await getTeamSquad(t.fotmobId);
    } catch (e) {
      console.warn(`   ⚠️  sin plantilla para ${t.name}: ${(e as Error).message}`);
      continue;
    }
    if (squad.length === 0) continue;

    const country = await prisma.country.create({
      data: {
        name: t.name,
        flag: flagFor(t.name),
        group: t.group ?? "?",
        fotmobId: t.fotmobId,
        logoUrl: teamLogoUrl(t.fotmobId),
      },
    });
    countryByFotmob.set(t.fotmobId, country.id);

    await prisma.player.createMany({
      data: squad.map((p) => {
        const overall = overallFromValue(p);
        return {
          name: p.name,
          position: POS_MAP[p.position] ?? "MED",
          rating: overall,
          basePrice: priceFromOverall(overall),
          countryId: country.id,
          fotmobId: p.fotmobId,
          photoUrl: playerPhotoUrl(p.fotmobId),
          age: p.age,
        };
      }),
      skipDuplicates: true, // un jugador puede aparecer en dos convocatorias raras veces
    });
    totalPlayers += squad.length;
    console.log(`   ✅ ${flagFor(t.name)} ${t.name} (${t.group ?? "?"}) — ${squad.length} jugadores`);
    await sleep(300); // rate limiting cortés
  }

  // 2) Jornadas (Gameweek) a partir de los rounds presentes en el calendario
  const roundDeadline = new Map<number, Date>();
  for (const m of matches) {
    if (m.round == null || !m.utcTime) continue;
    const d = new Date(m.utcTime);
    const cur = roundDeadline.get(m.round);
    if (!cur || d < cur) roundDeadline.set(m.round, d); // deadline = primer partido de la jornada
  }
  for (const [number, deadline] of [...roundDeadline.entries()].sort((a, b) => a[0] - b[0])) {
    const now = new Date();
    const status = deadline < now ? "finished" : "upcoming";
    await prisma.gameweek.upsert({
      where: { number },
      update: { deadline, status },
      create: { number, deadline, status },
    });
  }
  console.log(`   🗓️  jornadas creadas: ${roundDeadline.size}`);

  // 3) Fixtures reales
  let fx = 0;
  for (const m of matches) {
    if (!m.homeName || !m.awayName) continue;
    const status = m.finished ? "finished" : m.started ? "live" : "scheduled";
    await prisma.match.create({
      data: {
        fotmobId: m.fotmobId,
        homeCountryId: m.homeId ? countryByFotmob.get(m.homeId) ?? null : null,
        awayCountryId: m.awayId ? countryByFotmob.get(m.awayId) ?? null : null,
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

  console.log(`\n🌱 Listo: ${countryByFotmob.size} selecciones, ${totalPlayers} jugadores, ${fx} partidos.`);
  console.log("   Siguiente:  npm run sync   (ingiere ratings reales → puntos fantasy)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
