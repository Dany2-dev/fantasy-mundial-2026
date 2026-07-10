import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const include = {
  fromUser: { select: { id: true, name: true } },
  toUser: { select: { id: true, name: true } },
} as const;

async function withPlayers(trades: Awaited<ReturnType<typeof prisma.tradeOffer.findMany>>) {
  const ids = [...new Set(trades.flatMap((t) => [t.offeredPlayerId, t.requestedPlayerId]))];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, include: { team: true } });
  const byId = new Map(players.map((p) => [p.id, p]));
  return trades.map((t) => ({
    ...t,
    offeredPlayer: byId.get(t.offeredPlayerId),
    requestedPlayer: byId.get(t.requestedPlayerId),
  }));
}

router.get("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const trades = await prisma.tradeOffer.findMany({
    where: { leagueId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json({ trades: await withPlayers(trades) });
});

const offerSchema = z.object({
  leagueId: z.string().min(1),
  toUserId: z.string().min(1),
  offeredPlayerId: z.number().int(),
  requestedPlayerId: z.number().int(),
  coins: z.number().int().min(0).default(0),
});

router.post("/", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, toUserId, offeredPlayerId, requestedPlayerId, coins } = parsed.data;

  if (toUserId === userId) return res.status(400).json({ error: "No puedes ofertarte a ti mismo" });

  const [mine, theirs, me] = await Promise.all([
    prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId: offeredPlayerId } } }),
    prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId: requestedPlayerId } } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  if (!mine || mine.userId !== userId) return res.status(400).json({ error: "Esa carta no es tuya en esta liga" });
  if (!theirs || theirs.userId !== toUserId) return res.status(400).json({ error: "El otro mánager ya no tiene esa carta" });
  if (me.coins < coins) return res.status(400).json({ error: "No tienes esas monedas" });

  const trade = await prisma.tradeOffer.create({
    data: { leagueId, fromUserId: userId, toUserId, offeredPlayerId, requestedPlayerId, coins },
    include,
  });
  res.status(201).json({ trade: (await withPlayers([trade]))[0] });
});

router.post("/:id/respond", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const accept = Boolean(req.body?.accept);

  const trade = await prisma.tradeOffer.findUnique({ where: { id: req.params.id } });
  if (!trade) return res.status(404).json({ error: "Oferta no encontrada" });
  if (trade.toUserId !== userId) return res.status(403).json({ error: "Esta oferta no es para ti" });
  if (trade.status !== "pending") return res.status(409).json({ error: "La oferta ya fue respondida" });

  if (!accept) {
    await prisma.tradeOffer.update({ where: { id: trade.id }, data: { status: "rejected" } });
    return res.json({ ok: true, status: "rejected" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const [offered, requested, fromUser] = await Promise.all([
        tx.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId: trade.leagueId, playerId: trade.offeredPlayerId } } }),
        tx.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId: trade.leagueId, playerId: trade.requestedPlayerId } } }),
        tx.user.findUniqueOrThrow({ where: { id: trade.fromUserId } }),
      ]);
      if (!offered || offered.userId !== trade.fromUserId) throw new Error("La carta ofrecida cambió de dueño");
      if (!requested || requested.userId !== trade.toUserId) throw new Error("Tu carta cambió de dueño");
      if (fromUser.coins < trade.coins) throw new Error("El oferente ya no tiene esas monedas");

      // Intercambio de cartas
      await tx.ownedPlayer.update({ where: { id: offered.id }, data: { userId: trade.toUserId } });
      await tx.ownedPlayer.update({ where: { id: requested.id }, data: { userId: trade.fromUserId } });

      // Transferencia de monedas
      if (trade.coins > 0) {
        await tx.user.update({ where: { id: trade.fromUserId }, data: { coins: { decrement: trade.coins } } });
        await tx.user.update({ where: { id: trade.toUserId }, data: { coins: { increment: trade.coins } } });
      }

      // Sacar las cartas intercambiadas de los onces de ambos
      const squads = await tx.fantasySquad.findMany({
        where: { leagueId: trade.leagueId, userId: { in: [trade.fromUserId, trade.toUserId] } },
      });
      for (const squad of squads) {
        const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
        const cleaned = ids.filter((id) => id !== trade.offeredPlayerId && id !== trade.requestedPlayerId);
        if (cleaned.length !== ids.length) {
          const captainOut = squad.captainId === trade.offeredPlayerId || squad.captainId === trade.requestedPlayerId;
          await tx.fantasySquad.update({
            where: { id: squad.id },
            data: { playerIds: cleaned.join(","), ...(captainOut ? { captainId: null } : {}) },
          });
        }
      }

      await tx.tradeOffer.update({ where: { id: trade.id }, data: { status: "accepted" } });
    });
  } catch (e) {
    return res.status(409).json({ error: e instanceof Error ? e.message : "No se pudo completar el intercambio" });
  }

  res.json({ ok: true, status: "accepted" });
});

export default router;
