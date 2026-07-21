import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { protectionExpiry } from "../services/economy";
import { getWallet, spend, transfer, WalletError } from "../services/wallet";

const router = Router();
router.use(requireAuth);

// Subir tu propia cláusula pagando de tu bolsillo — te protege de clausulazos baratos.
const raiseSchema = z.object({
  leagueId: z.string().min(1),
  playerId: z.number().int(),
  amount: z.number().int().min(1, "La subida debe ser mayor a 0"),
});

router.post("/raise", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = raiseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, playerId, amount } = parsed.data;

  const owned = await prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } });
  if (!owned || owned.userId !== userId) return res.status(400).json({ error: "Esa carta no es tuya en esta liga" });

  try {
    const updatedOwned = await prisma.$transaction(async (tx) => {
      await spend(tx, userId, leagueId, amount); // valida membresía y saldo de ESTA liga
      return tx.ownedPlayer.update({ where: { id: owned.id }, data: { clause: { increment: amount } } });
    });
    res.json({ clause: updatedOwned.clause });
  } catch (e) {
    if (e instanceof WalletError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

// Clausulazo: pagas la cláusula completa y te llevas al jugador de inmediato,
// salvo que esté dentro de su semana de protección.
const paySchema = z.object({
  leagueId: z.string().min(1),
  playerId: z.number().int(),
});

router.post("/pay", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { leagueId, playerId } = parsed.data;

  const owned = await prisma.ownedPlayer.findUnique({ where: { leagueId_playerId: { leagueId, playerId } } });
  if (!owned) return res.status(404).json({ error: "Ese jugador no tiene dueño en esta liga" });
  if (owned.userId === userId) return res.status(400).json({ error: "Ya es tu jugador" });
  if (owned.protectedUntil && owned.protectedUntil > new Date()) {
    return res.status(409).json({
      error: `Este jugador está protegido hasta el ${owned.protectedUntil.toLocaleDateString("es-MX")}`,
    });
  }

  // Valida que el comprador sea miembro de la liga y tenga saldo AHÍ.
  const buyerWallet = await getWallet(prisma, userId, leagueId);
  if (!buyerWallet) return res.status(403).json({ error: "No eres miembro de esta liga" });
  if (buyerWallet.coins < owned.clause) {
    return res.status(400).json({ error: "No te alcanza el presupuesto de esta liga" });
  }

  const sellerId = owned.userId;
  const clausePaid = owned.clause;

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.ownedPlayer.findUnique({ where: { id: owned.id } });
      if (!fresh || fresh.userId !== sellerId) throw new Error("Ese jugador ya cambió de dueño");
      if (fresh.protectedUntil && fresh.protectedUntil > new Date()) throw new Error("Ese jugador ya está protegido");

      await transfer(tx, { leagueId, fromUserId: userId, toUserId: sellerId, amount: clausePaid });
      await tx.ownedPlayer.update({
        where: { id: owned.id },
        data: {
          userId,
          clause: Math.round(clausePaid * 1.3),
          protectedUntil: protectionExpiry(),
        },
      });

      // Sacar la carta de cualquier once y venta abierta que la tuviera.
      await tx.playerListing.deleteMany({ where: { leagueId, playerId } });
      const squad = await tx.fantasySquad.findUnique({ where: { userId_leagueId: { userId: sellerId, leagueId } } });
      if (squad) {
        const ids = squad.playerIds ? squad.playerIds.split(",").map(Number) : [];
        const cleaned = ids.filter((id) => id !== playerId);
        if (cleaned.length !== ids.length) {
          await tx.fantasySquad.update({
            where: { id: squad.id },
            data: { playerIds: cleaned.join(","), ...(squad.captainId === playerId ? { captainId: null } : {}) },
          });
        }
      }
    });
  } catch (e) {
    return res.status(409).json({ error: e instanceof Error ? e.message : "No se pudo completar el clausulazo" });
  }

  res.json({ ok: true, clausePaid });
});

export default router;
