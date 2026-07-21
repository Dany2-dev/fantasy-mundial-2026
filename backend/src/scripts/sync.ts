// Runner CLI: ingiere resultados reales y recalcula puntuaciones.
//   npm run sync                      (sincroniza partidos jugados sin sincronizar)
//   npm run sync -- --force           (re-sincroniza todos los jugados/en vivo)
//   npm run sync -- --competition=1   (solo esa competencia, por id interno)
import { syncResults } from "../services/sync";

const force = process.argv.includes("--force");
const compArg = process.argv.find((a) => a.startsWith("--competition="));
const competitionId = compArg ? Number(compArg.slice(14)) : undefined;

console.log(`⏳ Sincronizando resultados reales de FotMob${force ? " (--force)" : ""}${competitionId ? ` (competencia=${competitionId})` : ""}…`);
syncResults({ force, limit: force ? 200 : 60, competitionId })
  .then((r) => {
    console.log("✅ Sync terminado:");
    console.log(`   partidos actualizados (marcador): ${r.matchesUpdated}`);
    console.log(`   partidos con detalle ingerido:    ${r.matchesSynced}`);
    console.log(`   stats de jugador upsert:          ${r.statsUpserted}`);
    console.log(`   puntuaciones de mánager recalc.:  ${r.scoresUpdated}`);
    console.log(`   jornadas cerradas:                ${r.gameweeksClosed}`);
    console.log(`   premios de jornada pagados:       ${r.rewardsPaid}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Sync falló:", e);
    process.exit(1);
  });
