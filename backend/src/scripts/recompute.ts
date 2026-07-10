// Recalcula UserGameweekScore de todas las jornadas con estadísticas.
// Útil tras armar/cambiar onces sin volver a bajar datos de FotMob.
//   npm run recompute
import { recomputeScores } from "../services/sync";

recomputeScores()
  .then((n) => {
    console.log(`✅ Puntuaciones de mánager recalculadas: ${n}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Recompute falló:", e);
    process.exit(1);
  });
