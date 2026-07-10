// Sobre inicial: al entrar a una liga (crearla o unirse) el mánager recibe
// gratis un 4-4-2 completo (11 cartas) — jugadores normales, con como máximo
// UN crack (rating dentro del top ~4% de la competencia, ver services/rarity).
import { prisma } from "../lib/prisma";
import { initialClause, protectionExpiry } from "./economy";
import { eliteThreshold } from "./rarity";

type Pos = "POR" | "DEF" | "MED" | "DEL";
const TEMPLATE: { position: Pos; count: number }[] = [
  { position: "POR", count: 1 },
  { position: "DEF", count: 4 },
  { position: "MED", count: 4 },
  { position: "DEL", count: 2 },
];

function weightNormal(threshold: number, rating: number) {
  return Math.pow(Math.max(threshold - rating, 1), 1.4);
}

function pickWeighted<T>(pool: T[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

export async function grantStarterPack(userId: string, leagueId: string, competitionId: number) {
  // Idempotente: si ya tiene cartas en esta liga, no se repite el regalo.
  const already = await prisma.ownedPlayer.count({ where: { userId, leagueId } });
  if (already > 0) return null;

  const taken = await prisma.ownedPlayer.findMany({ where: { leagueId }, select: { playerId: true } });
  const takenIds = new Set(taken.map((t) => t.playerId));

  const all = await prisma.player.findMany({ where: { competitionId } });
  const pool = all.filter((p) => !takenIds.has(p.id));
  if (pool.length < 11) return null; // la competencia aún no tiene plantilla suficiente

  const threshold = await eliteThreshold(competitionId);
  const elitePool = pool.filter((p) => p.rating >= threshold);
  const normalPool = pool.filter((p) => p.rating < threshold);

  const picked: typeof pool = [];
  let eliteSlotPosition: Pos | null = null;
  let eliteId: number | null = null;

  // 1) Como máximo 1 crack, al azar entre los disponibles de la competencia.
  if (elitePool.length > 0) {
    const chosen = elitePool[Math.floor(Math.random() * elitePool.length)];
    picked.push(chosen);
    eliteSlotPosition = chosen.position as Pos;
    eliteId = chosen.id;
  }

  // 2) Rellenar el 4-4-2 con normales, sesgo hacia rating bajo/medio.
  let eliteConsumed = false;
  for (const slot of TEMPLATE) {
    const usesEliteSlot = !eliteConsumed && slot.position === eliteSlotPosition;
    if (usesEliteSlot) eliteConsumed = true;
    const need = slot.count - (usesEliteSlot ? 1 : 0);

    const available = normalPool.filter((p) => p.position === slot.position && !picked.includes(p));
    let remaining = need;
    while (remaining > 0 && available.length > 0) {
      const weights = available.map((p) => weightNormal(threshold, p.rating));
      const idx = pickWeighted(available, weights);
      picked.push(available[idx]);
      available.splice(idx, 1);
      remaining--;
    }
  }

  // 3) Si algún puesto se quedó corto (competencia chica), rellenar con
  //    cualquier jugador normal libre hasta llegar a 11.
  if (picked.length < 11) {
    const rest = normalPool.filter((p) => !picked.includes(p));
    while (picked.length < 11 && rest.length > 0) {
      const idx = Math.floor(Math.random() * rest.length);
      picked.push(rest[idx]);
      rest.splice(idx, 1);
    }
  }

  await prisma.$transaction([
    prisma.ownedPlayer.createMany({
      data: picked.map((p) => ({
        userId,
        leagueId,
        playerId: p.id,
        clause: initialClause(p.basePrice),
        protectedUntil: protectionExpiry(),
      })),
    }),
    prisma.fantasySquad.upsert({
      where: { userId_leagueId: { userId, leagueId } },
      update: { formation: "4-4-2", playerIds: picked.map((p) => p.id).join(","), captainId: eliteId },
      create: {
        userId,
        leagueId,
        formation: "4-4-2",
        playerIds: picked.map((p) => p.id).join(","),
        captainId: eliteId,
      },
    }),
  ]);

  return picked;
}
