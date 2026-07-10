// Runner CLI: ingiere resultados reales y recalcula puntuaciones.
//   npm run sync            (sincroniza partidos jugados sin sincronizar)
//   npm run sync -- --force (re-sincroniza todos los jugados/en vivo)
import { syncResults } from "../services/sync";

const force = process.argv.includes("--force");

console.log(`⏳ Sincronizando resultados reales de FotMob${force ? " (--force)" : ""}…`);
syncResults({ force, limit: force ? 200 : 60 })
  .then((r) => {
    console.log("✅ Sync terminado:");
    console.log(`   partidos actualizados (marcador): ${r.matchesUpdated}`);
    console.log(`   partidos con detalle ingerido:    ${r.matchesSynced}`);
    console.log(`   stats de jugador upsert:          ${r.statsUpserted}`);
    console.log(`   puntuaciones de mánager recalc.:  ${r.scoresUpdated}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Sync falló:", e);
    process.exit(1);
  });
