import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { initialClause, protectionExpiry } from "../services/economy";
import { eliteThreshold } from "../services/rarity";

const router = Router();
router.use(requireAuth);

// Costos en € (misma escala que el valor de mercado de los jugadores).
export const PACKS = {
  bronce: { cost: 8_000_000, count: 3, label: "Sobre Bronce" },
  plata: { cost: 15_000_000, count: 3, label: "Sobre Plata" },
  oro: { cost: 30_000_000, count: 3, label: "Sobre Oro" },
  legendario: { cost: 60_000_000, count: 3, label: "Sobre Legendario" },
} as const;

type Tier = keyof typeof PACKS;

// Fracción "élite" garantizada por sobre — oro sortea del top ~4% de la
// competencia, legendario aprieta el corte al top ~1.5% (más caro, más raro).
const ELITE_FRACTION: Partial<Record<Tier, number>> = { oro: 0.04, legendario: 0.015 };

function weightFor(tier: Tier, rating: number) {
  // Bronce favorece ratings bajos, plata es uniforme, oro favorece altos,
  // legendario favorece los altos con más fuerza todavía.
  if (tier === "bronce") return Math.pow(95 - rating, 2);
  if (tier === "oro") return Math.pow(rating - 65, 2);
  if (tier === "legendario") return Math.pow(rating - 60, 3);
  return 1;
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

router.get("/", (_req, res) => {
  res.json({ packs: Object.entries(PACKS).map(([tier, p]) => ({ tier, ...p })) });
});

router.post("/open", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const { leagueId, tier } = req.body ?? {};

  if (!(tier in PACKS)) return res.status(400).json({ error: "Tipo de sobre inválido" });
  const pack = PACKS[tier as Tier];

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: String(leagueId) } },
    include: { league: { select: { competitionId: true } } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  if (membership.coins < pack.cost) {
    return res.status(400).json({ error: "No te alcanza el presupuesto de esta liga para este sobre" });
  }

  // Exclusividad por liga: solo jugadores de ESTA competencia SIN dueño en esta liga.
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

  // Oro y Legendario garantizan al menos un crack (élite de la competencia,
  // legendario con un corte más estricto) si existe alguna carta libre.
  const picked: typeof pool = [];
  const available = [...pool];
  const eliteFraction = ELITE_FRACTION[tier as Tier];
  if (eliteFraction) {
    const threshold = await eliteThreshold(membership.league.competitionId, eliteFraction);
    const elite = available.filter((p) => p.rating >= threshold);
    if (elite.length > 0) {
      const idx = Math.floor(Math.random() * elite.length);
      picked.push(elite[idx]);
      available.splice(available.indexOf(elite[idx]), 1);
    }
  }
  while (picked.length < pack.count) {
    const weights = available.map((p) => weightFor(tier as Tier, p.rating));
    const idx = pickWeighted(available, weights);
    picked.push(available[idx]);
    available.splice(idx, 1);
  }

  const [updated] = await prisma.$transaction([
    prisma.leagueMembership.update({
      where: { id: membership.id },
      data: { coins: { decrement: pack.cost } },
      select: { coins: true },
    }),
    prisma.ownedPlayer.createMany({
      data: picked.map((p) => ({
        userId,
        leagueId: String(leagueId),
        playerId: p.id,
        clause: initialClause(p.basePrice),
        protectedUntil: protectionExpiry(),
      })),
    }),
  ]);

  res.json({
    players: picked.sort((a, b) => a.rating - b.rating), // reveal: la mejor al final
    coins: updated.coins,
  });
});

export default router;
