import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { initialClause, protectionExpiry } from "../services/economy";
import { eliteThreshold } from "../services/rarity";
import { PACKS } from "./packs";

// Extensión de /api/packs: abrir un sobre restringido a los jugadores de UNA
// selección/equipo (país) de la competencia de la liga, en vez de sortear de
// toda la competencia. Vive en un archivo nuevo (no se tocó packs.ts) y
// reutiliza sus mismos costos/probabilidades importando PACKS desde ahí.

const router = Router();
router.use(requireAuth);

type Tier = keyof typeof PACKS;

const ELITE_FRACTION: Partial<Record<Tier, number>> = { oro: 0.04, legendario: 0.015 };

function weightFor(tier: Tier, rating: number) {
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

// Selecciones/equipos de la competencia de la liga con al menos un jugador
// libre — arma el selector de país en el front (Sobres).
router.get("/teams", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
    include: { league: { select: { competitionId: true } } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const [teams, taken, players] = await Promise.all([
    prisma.team.findMany({
      where: { competitionId: membership.league.competitionId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, logoUrl: true, flag: true },
    }),
    prisma.ownedPlayer.findMany({ where: { leagueId }, select: { playerId: true } }),
    prisma.player.findMany({
      where: { competitionId: membership.league.competitionId },
      select: { id: true, teamId: true },
    }),
  ]);
  const takenIds = new Set(taken.map((t) => t.playerId));

  const freeCountByTeam = new Map<number, number>();
  for (const p of players) {
    if (takenIds.has(p.id)) continue;
    freeCountByTeam.set(p.teamId, (freeCountByTeam.get(p.teamId) ?? 0) + 1);
  }

  res.json({
    teams: teams
      .map((t) => ({ ...t, freeCount: freeCountByTeam.get(t.id) ?? 0 }))
      .filter((t) => t.freeCount > 0),
  });
});

// Igual que POST /api/packs/open, pero el pool se filtra también por teamId.
router.post("/open-by-team", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const { leagueId, tier, teamId } = req.body ?? {};

  if (!(tier in PACKS)) return res.status(400).json({ error: "Tipo de sobre inválido" });
  const pack = PACKS[tier as Tier];
  const teamIdNum = Number(teamId);
  if (!teamIdNum) return res.status(400).json({ error: "Selección inválida" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: String(leagueId) } },
    include: { league: { select: { competitionId: true } } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  if (membership.coins < pack.cost) {
    return res.status(400).json({ error: "No te alcanza el presupuesto de esta liga para este sobre" });
  }

  const team = await prisma.team.findUnique({ where: { id: teamIdNum } });
  if (!team || team.competitionId !== membership.league.competitionId) {
    return res.status(400).json({ error: "Esa selección no pertenece a la competencia de tu liga" });
  }

  // Exclusividad por liga: solo jugadores de esa selección SIN dueño en esta liga.
  const taken = await prisma.ownedPlayer.findMany({
    where: { leagueId: String(leagueId) },
    select: { playerId: true },
  });
  const takenIds = new Set(taken.map((t) => t.playerId));
  const pool = (
    await prisma.player.findMany({
      where: { competitionId: membership.league.competitionId, teamId: teamIdNum },
      include: { team: true },
    })
  ).filter((p) => !takenIds.has(p.id));

  if (pool.length < pack.count) {
    return res.status(409).json({ error: "Ya casi no quedan cartas libres de esa selección en esta liga" });
  }

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
    players: picked.sort((a, b) => a.rating - b.rating),
    coins: updated.coins,
  });
});

export default router;
