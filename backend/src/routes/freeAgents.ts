import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { protectionExpiry } from "../services/economy";
import { BATCH_HOURS, currentFreeAgents } from "../services/freeAgents";
import { getWallet } from "../services/wallet";

const router = Router();
router.use(requireAuth);

// Lote vigente de agentes libres de la liga. Se renueva solo cada 24 h.
router.get("/", async (req, res) => {
  const leagueId = String(req.query.leagueId ?? "");
  if (!leagueId) return res.status(400).json({ error: "leagueId es obligatorio" });

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: (req as AuthRequest).userId, leagueId } },
    select: { id: true },
  });
  if (!membership) return res.status(403).json({ error: "No eres miembro de esta liga" });

  const agents = await currentFreeAgents(prisma, leagueId);
  res.json({
    agents,
    // El front usa esto para el contador de "próximo mercado en …".
    refreshesAt: agents[0]?.expiresAt ?? null,
    batchHours: BATCH_HOURS,
  });
});

const signSchema = z.object({
  leagueId: z.string().min(1),
  playerId: z.number().int(),
});

router.post("/sign", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = signSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, playerId } = parsed.data;

  const wallet = await getWallet(prisma, userId, leagueId);
  if (!wallet) return res.status(403).json({ error: "No eres miembro de esta liga" });

  try {
    await prisma.$transaction(async (tx) => {
      const agent = await tx.freeAgent.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } });
      if (!agent) throw new Error("Ese jugador ya no está en el mercado");
      if (agent.expiresAt <= new Date()) throw new Error("Ese lote del mercado ya venció");

      const fresh = await tx.leagueMembership.findUnique({
        where: { userId_leagueId: { userId, leagueId } },
        select: { id: true, coins: true },
      });
      if (!fresh) throw new Error("No eres miembro de esta liga");
      if (fresh.coins < agent.price) throw new Error("No te alcanza el presupuesto de esta liga");

      // El fichaje sale del presupuesto y no entra a ningún otro mánager: el
      // agente libre no tiene dueño previo, así que el dinero sale del juego.
      await tx.leagueMembership.update({
        where: { id: fresh.id },
        data: { coins: { decrement: agent.price } },
      });
      // Si otro mánager fichó a este jugador entre medias, el índice único de
      // OwnedPlayer aborta aquí y la transacción entera se revierte.
      await tx.ownedPlayer.create({
        data: {
          userId,
          leagueId,
          playerId,
          clause: Math.round(agent.price * 1.5),
          protectedUntil: protectionExpiry(),
        },
      });
      await tx.freeAgent.delete({ where: { id: agent.id } });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo completar el fichaje";
    // P2002 = otro mánager ganó la carrera por la misma carta.
    return res.status(409).json({
      error: msg.includes("Unique constraint") ? "Otro mánager acaba de fichar a ese jugador" : msg,
    });
  }

  res.json({ ok: true });
});

export default router;
