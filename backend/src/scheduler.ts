// Mantiene los datos de partidos frescos sin depender de que alguien corra
// `npm run sync` a mano: dos jobs en segundo plano dentro del propio proceso
// del backend.
//   - Marcador/estado: cada pocos minutos, 1 request liviano por competencia
//     (getLeague). Es lo que le importa al marcador en vivo — se mantiene muy
//     por debajo del retraso máximo de 10 min que se pidió.
//   - Sync completo: cada rato más largo, ingiere ratings/goles/asistencias
//     de los partidos recién terminados/en vivo (más caro: 1 request por
//     partido) y recalcula puntuaciones fantasy.
// Ambos se saltan la corrida si la anterior sigue en curso (evita solapes si
// FotMob responde lento) y corren una vez de inmediato al arrancar el server.
import { refreshScoreboards, syncResults } from "./services/sync";

const SCOREBOARD_INTERVAL_MS = 3 * 60 * 1000;
const FULL_SYNC_INTERVAL_MS = 10 * 60 * 1000;

let scoreboardBusy = false;
let fullSyncBusy = false;

async function runScoreboardRefresh() {
  if (scoreboardBusy) return;
  scoreboardBusy = true;
  try {
    const updated = await refreshScoreboards();
    if (updated > 0) console.log(`🔄 [scheduler] marcador actualizado: ${updated} partido(s)`);
  } catch (e) {
    console.warn("⚠️  [scheduler] refresco de marcador falló:", (e as Error).message);
  } finally {
    scoreboardBusy = false;
  }
}

async function runFullSync() {
  if (fullSyncBusy) return;
  fullSyncBusy = true;
  try {
    const r = await syncResults({ limit: 60 });
    if (r.matchesSynced > 0 || r.statsUpserted > 0) {
      console.log(
        `✅ [scheduler] sync completo: ${r.matchesSynced} partido(s), ${r.statsUpserted} stats, ${r.scoresUpdated} puntuaciones`
      );
    }
  } catch (e) {
    console.warn("⚠️  [scheduler] sync completo falló:", (e as Error).message);
  } finally {
    fullSyncBusy = false;
  }
}

export function startScheduler() {
  runScoreboardRefresh();
  setTimeout(runFullSync, 15_000);

  setInterval(runScoreboardRefresh, SCOREBOARD_INTERVAL_MS);
  setInterval(runFullSync, FULL_SYNC_INTERVAL_MS);

  console.log(
    `⏱️  scheduler activo — marcador cada ${SCOREBOARD_INTERVAL_MS / 60000} min, sync completo cada ${FULL_SYNC_INTERVAL_MS / 60000} min`
  );
}
