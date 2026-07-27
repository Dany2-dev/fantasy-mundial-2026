import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { initialClause, protectionExpiry } from "../services/economy";
import { PACKS } from "./packs";

// Sobre gratis diario: una vez cada 24h por (usuario, liga), siempre bronce
// o plata (nunca oro/legendario, a propósito). El cooldown vive en memoria
// del proceso Node (decisión explícita del equipo para no tocar
// schema.prisma ni agregar una migración): se reinicia si el server se
// reinicia, no persiste en disco ni en la base de datos.

const router = Router();
router.use(requireAuth);

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
type FreeTier = "bronce" | "plata";
// Probabilidad del sobre gratis: la mayoría de las veces bronce, con una
// chance menor de plata. Nunca oro/legendario (no están en esta lista).
const FREE_TIER_WEIGHTS: { tier: FreeTier; weight: number }[] = [
  { tier: "bronce", weight: 0.7 },
  { tier: "plata", weight: 0.3 },
];

const lastClaimAt = new Map<string, number>(); // key: `${userId}:${leagueId}` -> epoch ms

function keyFor(userId: string, leagueId: string) {
  return `${userId}:${leagueId}`;
}

function nextAvailableAt(userId: string, leagueId: string): number | null {
  const last = lastClaimAt.get(keyFor(userId, leagueId));
  return last ? last + COOLDOWN_MS : null;
}

function pickFreeTier(): FreeTier {
  const total = FREE_TIER_WEIGHTS.reduce((a, w) => a + w.weight, 0);
  let r = Math.random() * total;
  for (const w of FREE_TIER_WEIGHTS) {
    r -= w.weight;
    if (r <= 0) return w.tier;
  }
  return FREE_TIER_WEIGHTS[FREE_TIER_WEIGHTS.length - 1].tier;
}

// Mismo criterio que weightFor en packs.ts para bronce/plata (sin fracción
// élite: el sobre gratis nunca garantiza un crack).
function weightFor(tier: FreeTier, rating: number) {
  if (tier === "bronce") return Math.pow(95 - rating, 2);
  return 1; // plata: uniforme
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

// Estado del sobre gratis: si ya se puede reclamar y, si no, cuándo.
router.get("/daily", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const nextAt = nextAvailableAt(userId, leagueId);
  res.json({
    canClaim: !nextAt || Date.now() >= nextAt,
    nextAvailableAt: nextAt ? new Date(nextAt).toISOString() : null,
  });
});

// Reclama el sobre gratis del día: bronce o plata, 3 cartas, sin costo.
router.post("/daily/claim", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const { leagueId } = req.body ?? {};
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: String(leagueId) } },
    include: { league: { select: { competitionId: true } } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const nextAt = nextAvailableAt(userId, String(leagueId));
  if (nextAt && Date.now() < nextAt) {
    return res.status(429).json({
      error: "Todavía no te toca tu sobre gratis, revisa el contador",
      nextAvailableAt: new Date(nextAt).toISOString(),
    });
  }

  const tier = pickFreeTier();
  const pack = PACKS[tier];

  const taken = await prisma.ownedPlayer.findMany({
    where: { leagueId: String(leagueId) },
    select: { playerId: true },
  });
  const takenIds = new Set(taken.map((t) => t.playerId));
  const pool = (
    await prisma.player.findMany({
      where: { competitionId: membership.league.competitionId },
      include: { team: true },
    })
  ).filter((p) => !takenIds.has(p.id));

  if (pool.length < pack.count) {
    return res.status(409).json({ error: "Ya casi no quedan cartas libres en esta liga" });
  }

  const picked: typeof pool = [];
  const available = [...pool];
  while (picked.length < pack.count) {
    const weights = available.map((p) => weightFor(tier, p.rating));
    const idx = pickWeighted(available, weights);
    picked.push(available[idx]);
    available.splice(idx, 1);
  }

  await prisma.ownedPlayer.createMany({
    data: picked.map((p) => ({
      userId,
      leagueId: String(leagueId),
      playerId: p.id,
      clause: initialClause(p.basePrice),
      protectedUntil: protectionExpiry(),
    })),
  });

  lastClaimAt.set(keyFor(userId, String(leagueId)), Date.now());

  res.json({
    tier,
    players: picked.sort((a, b) => a.rating - b.rating),
    nextAvailableAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
  });
});

export default router;
