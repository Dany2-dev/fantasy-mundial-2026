import { Router } from "express";
import { prisma } from "../lib/prisma";
import { gwLabel } from "../lib/rounds";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();

// Equipos de una competencia (para filtros del front).
router.get("/teams", requireAuth, async (req, res) => {
  const competitionId = Number(req.query.competitionId);
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });
  const teams = await prisma.team.findMany({
    where: { competitionId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, logoUrl: true, flag: true, group: true },
  });
  res.json({ teams });
});

// Jugadores de una competencia (con filtros).
router.get("/players", requireAuth, async (req, res) => {
  const { search, position, teamId, competitionId } = req.query;
  if (!competitionId) return res.status(400).json({ error: "competitionId es obligatorio" });
  const players = await prisma.player.findMany({
    where: {
      competitionId: Number(competitionId),
      ...(typeof search === "string" && search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(typeof position === "string" && position ? { position } : {}),
      ...(typeof teamId === "string" && teamId ? { teamId: Number(teamId) } : {}),
    },
    include: { team: { select: { id: true, name: true, logoUrl: true, flag: true } } },
    orderBy: { rating: "desc" },
  });
  res.json({ players });
});

// Detalle de un jugador: bio, dueño/cláusula/protección en la liga y su
// historial de estadísticas por jornada (para el modal al tocar la carta).
router.get("/players/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const playerId = Number(req.params.id);
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!player) return res.status(404).json({ error: "Jugador no encontrado" });

  const [owned, listing, statRows] = await Promise.all([
    prisma.ownedPlayer.findUnique({
      where: { leagueId_playerId: { leagueId, playerId } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.playerListing.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } }),
    prisma.playerGameweekStats.findMany({
      where: { playerId },
      include: { gameweek: { select: { number: true, deadline: true, status: true } } },
      orderBy: { gameweek: { number: "desc" } },
    }),
  ]);

  // Cruzar cada jornada con el partido real del equipo del jugador (rival, marcador).
  const rounds = statRows.map((s) => s.gameweek.number);
  const matches = rounds.length
    ? await prisma.match.findMany({
        where: {
          competitionId: player.competitionId,
          round: { in: rounds },
          OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
        },
        include: { homeTeam: { select: { name: true, logoUrl: true } }, awayTeam: { select: { name: true, logoUrl: true } } },
      })
    : [];
  const matchByRound = new Map(matches.map((m) => [m.round, m]));

  const stats = statRows.map((s) => {
    const match = matchByRound.get(s.gameweek.number);
    const isHome = match?.homeTeamId === player.teamId;
    return {
      gameweek: s.gameweek.number,
      gameweekLabel: gwLabel(s.gameweek.number),
      status: s.gameweek.status,
      goals: s.goals,
      assists: s.assists,
      points: s.points,
      match: match
        ? {
            opponent: isHome ? match.awayTeam?.name ?? match.awayName : match.homeTeam?.name ?? match.homeName,
            opponentLogo: isHome ? match.awayTeam?.logoUrl ?? null : match.homeTeam?.logoUrl ?? null,
            home: isHome,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            utcTime: match.utcTime,
            status: match.status,
          }
        : null,
    };
  });

  res.json({
    player,
    ownership: owned
      ? {
          owner: owned.user,
          isMine: owned.userId === userId,
          clause: owned.clause,
          protectedUntil: owned.protectedUntil,
          protected: Boolean(owned.protectedUntil && owned.protectedUntil > new Date()),
        }
      : null,
    listing: listing ? { id: listing.id, price: listing.price, sellerId: listing.sellerId } : null,
    stats,
  });
});

export default router;
