// Ruta temporal para cargar los datos de referencia (competencias, equipos,
// jugadores, partidos) en la BD de Azure desde el propio proceso del backend
// —usa la MISMA conexión que ya funciona en runtime—, porque la Postgres de
// Azure no es alcanzable directamente desde la red del desarrollador.
// Protegida por ADMIN_SECRET (variable de entorno en Azure, nunca en el código).
// Borrar esta ruta (y azure_seed.sql / reference_data.sql del build) una vez
// que los datos queden cargados y verificados.
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const REF_TABLES_IN_DELETE_ORDER = [
  "PlayerGameweekStats",
  "Match",
  "Player",
  "Gameweek",
  "Team",
  "Competition",
] as const;

router.post("/load-reference-data", async (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.header("x-admin-secret") !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const filePath = path.join(__dirname, "..", "..", "reference_data.sql");
  if (!fs.existsSync(filePath)) {
    return res.status(500).json({ error: `No se encontró ${filePath}` });
  }

  const lines = fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((l) => l.startsWith("INSERT INTO"));

  try {
    // Limpia solo las tablas de referencia (no toca User/League/OwnedPlayer…).
    for (const t of REF_TABLES_IN_DELETE_ORDER) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
    }

    let inserted = 0;
    const errors: { line: number; message: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        await prisma.$executeRawUnsafe(lines[i]);
        inserted++;
      } catch (e) {
        errors.push({ line: i, message: (e as Error).message.slice(0, 300) });
        if (errors.length >= 10) break; // no seguir acumulando si algo está mal de raíz
      }
    }

    res.json({ ok: errors.length === 0, totalLines: lines.length, inserted, errors });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/reference-counts", async (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.header("x-admin-secret") !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }
  const [competitions, teams, players, gameweeks, matches, stats] = await Promise.all([
    prisma.competition.count(),
    prisma.team.count(),
    prisma.player.count(),
    prisma.gameweek.count(),
    prisma.match.count(),
    prisma.playerGameweekStats.count(),
  ]);
  const priceAgg = await prisma.player.aggregate({ _min: { basePrice: true }, _max: { basePrice: true } });
  res.json({ competitions, teams, players, gameweeks, matches, stats, price: priceAgg._min, priceMax: priceAgg._max });
});

export default router;
