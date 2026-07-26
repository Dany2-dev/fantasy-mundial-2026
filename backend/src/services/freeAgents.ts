// Mercado de agentes libres: cada 24 h la liga saca un lote de jugadores sin
// dueño que cualquier mánager puede fichar al contado.
//
// El lote se regenera de forma PEREZOSA: la primera petición que llega después
// de que venció el anterior lo renueva. Se hizo así a propósito para no
// depender de un cron — el backend vive en un contenedor que Azure puede
// reciclar en cualquier momento, y un lote que solo existe si el proceso
// siguió vivo sería un mercado que a veces simplemente no aparece.

import { Prisma, PrismaClient } from "@prisma/client";
import { valueFromOverall } from "./economy";

/** Duración de un lote. Vencido esto, el siguiente que abra el mercado lo renueva. */
export const BATCH_HOURS = 24;
/** Cuántos jugadores salen por lote. */
export const BATCH_SIZE = 12;

/**
 * Reparto por franja de rating dentro del lote. La idea es que el mercado
 * diario siempre tenga algo ilusionante arriba sin regalar cracks: 1 estrella,
 * un par de buenos y el resto de relleno útil para completar plantilla.
 */
const BANDS = [
  { min: 0.97, max: 1.0, count: 1 }, // top 3% de la competencia
  { min: 0.85, max: 0.97, count: 3 },
  { min: 0.55, max: 0.85, count: 4 },
  { min: 0.0, max: 0.55, count: 4 },
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

/** Precio de fichaje de un agente libre. */
export function freeAgentPrice(basePrice: number, rating: number): number {
  // Si el seed no trajo valor de mercado, se estima desde el rating para no
  // publicar jugadores a precio 0.
  const base = basePrice > 0 ? basePrice : valueFromOverall(rating);
  // Pequeña prima sobre el valor: fichar del mercado diario es cómodo, y sin
  // esto siempre sería más barato que cualquier operación entre mánagers.
  return Math.round((base * 1.1) / 50_000) * 50_000;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(...copy.splice(Math.floor(Math.random() * copy.length), 1));
  }
  return out;
}

/**
 * Devuelve el lote vigente de la liga, regenerándolo si venció.
 * Idempotente: si dos peticiones entran a la vez, la segunda choca contra el
 * índice único y se queda con el lote que escribió la primera.
 */
export async function currentFreeAgents(db: PrismaClient, leagueId: string) {
  const now = new Date();
  const live = await db.freeAgent.count({ where: { leagueId, expiresAt: { gt: now } } });
  if (live > 0) return listFreeAgents(db, leagueId);

  try {
    await regenerate(db, leagueId, now);
  } catch (e) {
    // Carrera con otra petición que ya generó el lote: no es un error, el
    // `listFreeAgents` de abajo devuelve el que ganó.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return listFreeAgents(db, leagueId);
}

async function regenerate(db: PrismaClient, leagueId: string, now: Date) {
  const league = await db.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true },
  });
  if (!league) return;

  // Jugadores de la competencia que NADIE tiene en esta liga. Es la misma
  // regla de exclusividad que aplican los sobres: una carta, un dueño.
  const [players, owned] = await Promise.all([
    db.player.findMany({
      where: { competitionId: league.competitionId },
      select: { id: true, rating: true, basePrice: true },
    }),
    db.ownedPlayer.findMany({ where: { leagueId }, select: { playerId: true } }),
  ]);

  const takenIds = new Set(owned.map((o) => o.playerId));
  const free = players.filter((p) => !takenIds.has(p.id));
  if (free.length === 0) {
    await db.freeAgent.deleteMany({ where: { leagueId } });
    return;
  }

  // Las bandas se calculan sobre los libres ordenados por rating, así que
  // "top 3%" significa lo mejor que queda disponible, no un corte absoluto
  // que dejaría el lote vacío en ligas ya muy repartidas.
  const sorted = [...free].sort((a, b) => a.rating - b.rating);
  const chosen: typeof sorted = [];
  const used = new Set<number>();

  for (const band of BANDS) {
    const from = Math.floor(sorted.length * band.min);
    const to = Math.max(from + 1, Math.ceil(sorted.length * band.max));
    const slice = sorted.slice(from, to).filter((p) => !used.has(p.id));
    for (const p of pickRandom(slice, band.count)) {
      chosen.push(p);
      used.add(p.id);
    }
  }
  // Si alguna banda quedó corta (liga casi agotada), se rellena con lo que haya.
  for (const p of pickRandom(sorted.filter((p) => !used.has(p.id)), BATCH_SIZE - chosen.length)) {
    chosen.push(p);
    used.add(p.id);
  }

  const expiresAt = new Date(now.getTime() + BATCH_HOURS * 60 * 60 * 1000);
  await db.$transaction([
    db.freeAgent.deleteMany({ where: { leagueId } }),
    db.freeAgent.createMany({
      data: chosen.map((p) => ({
        leagueId,
        playerId: p.id,
        price: freeAgentPrice(p.basePrice, p.rating),
        expiresAt,
      })),
    }),
  ]);
}

export function listFreeAgents(db: Db, leagueId: string) {
  return db.freeAgent.findMany({
    where: { leagueId },
    include: { player: { include: { team: true } } },
    orderBy: { price: "desc" },
  });
}
