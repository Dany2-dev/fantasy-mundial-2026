// Ruta temporal para cargar los datos de referencia (competencias, equipos,
// jugadores, partidos) en la BD de Azure desde el propio proceso del backend
// —usa la MISMA conexión que ya funciona en runtime—, porque la Postgres de
// Azure no es alcanzable directamente desde la red del desarrollador.
// Protegida por ADMIN_SECRET (variable de entorno en Azure, nunca en el código).
// Borrar esta ruta (y reference_data.sql del build) una vez que los datos
// queden cargados y verificados.
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// League primero: sus dependientes (LeagueMembership, OwnedPlayer, FantasySquad,
// TradeOffer, PlayerListing, UserGameweekScore) tienen onDelete: Cascade a nivel
// de BD, así que se limpian solas. Sin esto, borrar Competition falla con
// RESTRICT si ya existen ligas creadas apuntando a las competencias viejas.
const REF_TABLES_IN_DELETE_ORDER = [
  "League",
  "PlayerGameweekStats",
  "Match",
  "Player",
  "Gameweek",
  "Team",
  "Competition",
] as const;

// Reconstruye statements completos: cada INSERT del dump con --rows-per-insert
// viene partido en varias líneas (una fila por línea) hasta la que cierra con ";".
function parseStatements(sql: string): string[] {
  const statements: string[] = [];
  let current: string[] = [];
  for (const line of sql.split("\n")) {
    if (current.length === 0) {
      if (!line.startsWith("INSERT INTO")) continue;
      current.push(line);
    } else {
      current.push(line);
    }
    if (current.length > 0 && line.trimEnd().endsWith(";")) {
      statements.push(current.join("\n"));
      current = [];
    }
  }
  return statements;
}

type LoadStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  totalStatements: number;
  done: number;
  errors: { index: number; message: string }[];
};

const status: LoadStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  totalStatements: 0,
  done: 0,
  errors: [],
};

async function runLoad(statements: string[]) {
  status.running = true;
  status.startedAt = new Date().toISOString();
  status.finishedAt = null;
  status.totalStatements = statements.length;
  status.done = 0;
  status.errors = [];

  try {
    for (const t of REF_TABLES_IN_DELETE_ORDER) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
    }
    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(statements[i]);
      } catch (e) {
        status.errors.push({ index: i, message: (e as Error).message.slice(0, 500) });
        if (status.errors.length >= 15) break;
      }
      status.done = i + 1;
    }
  } catch (e) {
    status.errors.push({ index: -1, message: (e as Error).message.slice(0, 500) });
  } finally {
    status.running = false;
    status.finishedAt = new Date().toISOString();
  }
}

function checkAuth(req: import("express").Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.header("x-admin-secret") === secret;
}

// Dispara la carga en segundo plano y responde al toque (no bloquea la
// petición HTTP los varios minutos que puede tardar — Azure corta conexiones
// largas). Consulta el avance con GET /load-status.
router.post("/load-reference-data", (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "No autorizado" });
  if (status.running) return res.status(409).json({ error: "Ya hay una carga en curso", status });

  const filePath = path.join(__dirname, "..", "..", "reference_data.sql");
  if (!fs.existsSync(filePath)) {
    return res.status(500).json({ error: `No se encontró ${filePath}` });
  }
  const statements = parseStatements(fs.readFileSync(filePath, "utf-8"));
  if (statements.length === 0) {
    return res.status(500).json({ error: "No se encontraron statements INSERT en el archivo" });
  }

  runLoad(statements); // deliberadamente sin await: corre en segundo plano
  res.status(202).json({ started: true, totalStatements: statements.length });
});

router.get("/load-status", (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "No autorizado" });
  res.json(status);
});

router.get("/reference-counts", async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "No autorizado" });
  const [competitions, teams, players, gameweeks, matches, stats] = await Promise.all([
    prisma.competition.count(),
    prisma.team.count(),
    prisma.player.count(),
    prisma.gameweek.count(),
    prisma.match.count(),
    prisma.playerGameweekStats.count(),
  ]);
  const priceAgg = await prisma.player.aggregate({ _min: { basePrice: true }, _max: { basePrice: true } });
  res.json({
    competitions,
    teams,
    players,
    gameweeks,
    matches,
    stats,
    priceMin: priceAgg._min.basePrice,
    priceMax: priceAgg._max.basePrice,
  });
});

export default router;
