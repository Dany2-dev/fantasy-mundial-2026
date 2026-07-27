import { Router } from "express";
import { z } from "zod";
import { CUSTOM_CHALLENGE_ID, findWeeklyChallenge, WEEKLY_CHALLENGES } from "../lib/weeklyChallenges";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { currentGameweek, currentGameweekId } from "../services/gameweeks";
import { gwLabel } from "../lib/rounds";
import { STARTING_COINS, valueFromOverall } from "../services/economy";
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
      myCoins: m.coins, // presupuesto del usuario DENTRO de esta liga
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
  res.status(201).json({ league: { ...league, myCoins: STARTING_COINS }, starterPack });
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
  res.status(201).json({ league: { ...league, myCoins: STARTING_COINS }, starterPack });
});

// Catálogo fijo de retos para que el dueño de la liga elija uno (no depende
// de ninguna liga en particular, por eso va antes de las rutas /:id).
router.get("/challenges/catalog", (_req, res) => {
  res.json({ challenges: WEEKLY_CHALLENGES });
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
    include: { player: { select: { rating: true, basePrice: true } } },
  });

  const standings = league.members
    .map((m) => {
      const cards = owned.filter((o) => o.userId === m.userId);
      // Valor de plantilla en EUROS (valor de mercado real de cada carta). Antes
      // sumaba `rating`, así que un club salía valiendo "250" — un número sin
      // unidad que no cuadraba con ningún otro importe del juego.
      const squadValue = cards.reduce(
        (acc, o) => acc + (o.player.basePrice > 0 ? o.player.basePrice : valueFromOverall(o.player.rating)),
        0
      );
      return {
        userId: m.userId,
        name: m.user.name,
        points: league.scores
          .filter((s) => s.userId === m.userId)
          .reduce((acc, s) => acc + s.points, 0),
        cardCount: cards.length,
        teamValue: squadValue,
        // Patrimonio = plantilla + lo que le queda en caja. Es el número que de
        // verdad ordena quién va ganando el mercado.
        netWorth: squadValue + m.coins,
      };
    })
    .sort((a, b) => b.points - a.points || b.netWorth - a.netWorth);

  const gameweek = await currentGameweek(league.competitionId);
  const myMembership = league.members.find((m) => m.userId === userId);

  // Reto semanal vigente (si el dueño ya eligió uno para la jornada actual)
  // y quién va último, para mostrárselo a todos los miembros de la liga.
  const gameweekId = await currentGameweekId(league.competitionId);
  const weeklyChallenge = gameweekId
    ? await prisma.weeklyChallenge.findUnique({
        where: { leagueId_gameweekId: { leagueId: league.id, gameweekId } },
      })
    : null;
  const loser = standings.length > 0 ? standings[standings.length - 1] : null;

  res.json({
    league: {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      ownerId: league.ownerId,
      competition: league.competition,
      currentGameweek: gameweek,
      myCoins: myMembership?.coins ?? 0,
    },
    standings,
    loser,
    weeklyChallenge: weeklyChallenge ? { text: weeklyChallenge.text, gameweekLabel: gameweek?.label ?? null } : null,
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

// ---------- Administración de la liga (solo el dueño) ----------

// Renombrar la liga.
router.patch("/:id", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const league = await prisma.league.findUnique({ where: { id: req.params.id } });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (league.ownerId !== userId) {
    return res.status(403).json({ error: "Solo el dueño de la liga puede editarla" });
  }

  const parsed = z
    .object({ name: z.string().min(3, "El nombre necesita al menos 3 caracteres") })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const updated = await prisma.league.update({ where: { id: league.id }, data: { name: parsed.data.name } });
  res.json({ league: updated });
});

// Eliminar la liga por completo. Todo lo que cuelga de ella (membresías,
// cartas, ofertas, historial…) se borra en cascada por el esquema.
router.delete("/:id", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const league = await prisma.league.findUnique({ where: { id: req.params.id } });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (league.ownerId !== userId) {
    return res.status(403).json({ error: "Solo el dueño de la liga puede eliminarla" });
  }

  await prisma.league.delete({ where: { id: league.id } });
  res.status(204).end();
});

// Expulsar a un mánager. Sus cartas de ESTA liga quedan libres otra vez (la
// exclusividad es por liga), y se cancelan sus ventas y ofertas pendientes.
router.delete("/:id/members/:userId", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = req.params.id;
  const targetUserId = req.params.userId;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (league.ownerId !== userId) {
    return res.status(403).json({ error: "Solo el dueño de la liga puede expulsar miembros" });
  }
  if (targetUserId === league.ownerId) {
    return res.status(400).json({ error: "El dueño no puede expulsarse a sí mismo. Elimina la liga si quieres cerrarla" });
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: targetUserId, leagueId } },
  });
  if (!membership) return res.status(404).json({ error: "Ese mánager no pertenece a esta liga" });

  await prisma.$transaction([
    prisma.ownedPlayer.deleteMany({ where: { leagueId, userId: targetUserId } }),
    prisma.fantasySquad.deleteMany({ where: { leagueId, userId: targetUserId } }),
    prisma.playerListing.deleteMany({ where: { leagueId, sellerId: targetUserId } }),
    prisma.tradeOffer.deleteMany({
      where: { leagueId, OR: [{ fromUserId: targetUserId }, { toUserId: targetUserId }] },
    }),
    prisma.leagueMembership.delete({ where: { userId_leagueId: { userId: targetUserId, leagueId } } }),
  ]);

  res.status(204).end();
});

// El dueño elige, de un catálogo fijo, el reto para el último lugar de la
// jornada actual. Un solo reto por liga y jornada (upsert).
router.post("/:id/challenge", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const league = await prisma.league.findUnique({ where: { id: req.params.id } });
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (league.ownerId !== userId) {
    return res.status(403).json({ error: "Solo el dueño de la liga puede asignar el reto semanal" });
  }

  const parsed = z
    .object({
      challengeId: z.string().min(1),
      // Solo se usa cuando challengeId === CUSTOM_CHALLENGE_ID.
      text: z.string().trim().min(3, "El reto necesita al menos 3 caracteres").max(200).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  let challengeId: string;
  let text: string;
  if (parsed.data.challengeId === CUSTOM_CHALLENGE_ID) {
    if (!parsed.data.text) {
      return res.status(400).json({ error: "Escribe el reto que quieres asignar" });
    }
    challengeId = CUSTOM_CHALLENGE_ID;
    text = parsed.data.text;
  } else {
    const option = findWeeklyChallenge(parsed.data.challengeId);
    if (!option) return res.status(400).json({ error: "Ese reto no existe" });
    challengeId = option.id;
    text = option.text;
  }

  const gameweekId = await currentGameweekId(league.competitionId);
  if (!gameweekId) {
    return res.status(400).json({ error: "Esta competencia todavía no tiene calendario de jornadas" });
  }

  const challenge = await prisma.weeklyChallenge.upsert({
    where: { leagueId_gameweekId: { leagueId: league.id, gameweekId } },
    create: { leagueId: league.id, gameweekId, challengeId, text },
    update: { challengeId, text },
  });

  res.json({ weeklyChallenge: { text: challenge.text } });
});

export default router;
