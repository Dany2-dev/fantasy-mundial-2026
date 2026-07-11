import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { currentGameweek } from "../services/gameweeks";
import { gwLabel } from "../lib/rounds";
import { grantStarterPack } from "../services/starterPack";

const router = Router();
router.use(requireAuth);

function inviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para evitar confusión
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const memberships = await prisma.leagueMembership.findMany({
    where: { userId },
    include: {
      league: {
        include: {
          _count: { select: { members: true } },
          competition: { select: { id: true, name: true, logoUrl: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  res.json({
    leagues: memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      inviteCode: m.league.inviteCode,
      ownerId: m.league.ownerId,
      memberCount: m.league._count.members,
      competitionId: m.league.competitionId,
      competition: m.league.competition
        ? { id: m.league.competition.id, name: m.league.competition.name, logoUrl: m.league.competition.logoUrl }
        : null,
    })),
  });
});

router.post("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = z
    .object({
      name: z.string().min(3, "El nombre necesita al menos 3 caracteres"),
      competitionId: z.number().int("Elige una competencia"),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const competition = await prisma.competition.findUnique({ where: { id: parsed.data.competitionId } });
  if (!competition) return res.status(400).json({ error: "Esa competencia no existe" });

  const league = await prisma.league.create({
    data: {
      name: parsed.data.name,
      inviteCode: inviteCode(),
      ownerId: userId,
      competitionId: competition.id,
      members: { create: { userId } },
    },
  });

  const starterPack = await grantStarterPack(userId, league.id, competition.id);
  res.status(201).json({ league, starterPack });
});

router.post("/join", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  if (code.length !== 6) return res.status(400).json({ error: "El código tiene 6 caracteres" });

  const league = await prisma.league.findUnique({ where: { inviteCode: code } });
  if (!league) return res.status(404).json({ error: "No existe una liga con ese código" });

  const already = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: league.id } },
  });
  if (already) return res.status(409).json({ error: "Ya eres miembro de esta liga" });

  await prisma.leagueMembership.create({ data: { userId, leagueId: league.id } });
  const starterPack = await grantStarterPack(userId, league.id, league.competitionId);
  res.status(201).json({ league, starterPack });
});

// Detalle + clasificación
router.get("/:id", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const league = await prisma.league.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      scores: true,
      competition: { select: { id: true, name: true, logoUrl: true, type: true } },
    },
  });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!league.members.some((m) => m.userId === userId)) {
    return res.status(403).json({ error: "No eres miembro de esta liga" });
  }

  const owned = await prisma.ownedPlayer.findMany({
    where: { leagueId: league.id },
    include: { player: { select: { rating: true } } },
  });

  const standings = league.members
    .map((m) => {
      const cards = owned.filter((o) => o.userId === m.userId);
      return {
        userId: m.userId,
        name: m.user.name,
        points: league.scores
          .filter((s) => s.userId === m.userId)
          .reduce((acc, s) => acc + s.points, 0),
        cardCount: cards.length,
        teamValue: cards.reduce((acc, o) => acc + o.player.rating, 0),
      };
    })
    .sort((a, b) => b.points - a.points || b.teamValue - a.teamValue);

  const gameweek = await currentGameweek(league.competitionId);

  res.json({
    league: {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      ownerId: league.ownerId,
      competition: league.competition,
      currentGameweek: gameweek,
    },
    standings,
  });
});

// Tus puntos jornada a jornada en esta liga (para Historial).
router.get("/:id/scores", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = req.params.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const scores = await prisma.userGameweekScore.findMany({
    where: { userId, leagueId },
    include: { gameweek: { select: { number: true, status: true } } },
    orderBy: { gameweek: { number: "desc" } },
  });

  res.json({
    scores: scores.map((s) => ({
      gameweek: s.gameweek.number,
      gameweekLabel: gwLabel(s.gameweek.number),
      status: s.gameweek.status,
      points: s.points,
    })),
  });
});

export default router;
