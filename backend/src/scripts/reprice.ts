// Reprecifica la BD existente con el valor de mercado REAL de FotMob
// (transferValue) sin re-seedear: actualiza Player.basePrice y resetea las
// cláusulas de OwnedPlayer a initialClause(nuevo precio).
//   npm run db:reprice                       (todas las competencias)
//   npm run db:reprice -- --competition=2    (solo esa, por id interno)
import { PrismaClient } from "@prisma/client";
import { getTeamSquad } from "../lib/fotmob";
import { initialClause, valueFromOverall } from "../services/economy";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const compArg = process.argv.find((a) => a.startsWith("--competition="));
  const competitionId = compArg ? Number(compArg.slice(14)) : undefined;

  const teams = await prisma.team.findMany({
    where: competitionId ? { competitionId } : undefined,
    orderBy: { id: "asc" },
  });
  console.log(`💶 Reprecificando ${teams.length} equipo(s) con valores reales de FotMob…`);

  let updated = 0;
  let estimated = 0;
  for (const [i, t] of teams.entries()) {
    let valueByFotmob = new Map<number, number>();
    try {
      const squad = await getTeamSquad(t.fotmobId);
      valueByFotmob = new Map(
        squad.filter((p) => p.transferValue && p.transferValue > 0).map((p) => [p.fotmobId, p.transferValue!])
      );
    } catch (e) {
      console.warn(`   ⚠️  sin plantilla ${t.name}: ${(e as Error).message} — se estima por overall`);
    }

    const players = await prisma.player.findMany({ where: { teamId: t.id } });
    for (const p of players) {
      const real = valueByFotmob.get(p.fotmobId);
      if (!real) estimated++;
      await prisma.player.update({
        where: { id: p.id },
        data: { basePrice: real ?? valueFromOverall(p.rating) },
      });
      updated++;
    }
    if ((i + 1) % 20 === 0) console.log(`   … ${i + 1}/${teams.length} equipos`);
    await sleep(250); // rate limiting cortés
  }

  // Cláusulas coherentes con el nuevo precio (se pierden subidas manuales previas).
  const owned = await prisma.ownedPlayer.findMany({
    where: competitionId ? { player: { competitionId } } : undefined,
    include: { player: { select: { basePrice: true } } },
  });
  for (const o of owned) {
    await prisma.ownedPlayer.update({ where: { id: o.id }, data: { clause: initialClause(o.player.basePrice) } });
  }

  console.log(`✅ Listo: ${updated} jugadores reprecificados (${estimated} estimados sin valor público), ${owned.length} cláusulas reseteadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
