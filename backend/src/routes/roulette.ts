import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

export interface RouletteSlice {
  index: number;
  label: string;
  multiplier: number;
  weight: number;
  color: string;
  text: string;
}

export const ROULETTE_SLICES: RouletteSlice[] = [
  { index: 0, label: "0x", multiplier: 0, weight: 32, color: "#ef4444", text: "Pierdes Todo" },
  { index: 1, label: "0.2x", multiplier: 0.2, weight: 20, color: "#f97316", text: "Retorna 20%" },
  { index: 2, label: "0.5x", multiplier: 0.5, weight: 18, color: "#f59e0b", text: "Retorna Mitad" },
  { index: 3, label: "1.0x", multiplier: 1.0, weight: 12, color: "#eab308", text: "Empate" },
  { index: 4, label: "1.5x", multiplier: 1.5, weight: 8, color: "#10b981", text: "+50% Bonus" },
  { index: 5, label: "2x", multiplier: 2.0, weight: 5, color: "#06b6d4", text: "¡Doble!" },
  { index: 6, label: "3x", multiplier: 3.0, weight: 2.5, color: "#3b82f6", text: "¡Triple!" },
  { index: 7, label: "5x", multiplier: 5.0, weight: 1.5, color: "#8b5cf6", text: "¡Gran Premio!" },
  { index: 8, label: "15x", multiplier: 15.0, weight: 0.7, color: "#d946ef", text: "¡MEGA PREMIO!" },
  { index: 9, label: "50x", multiplier: 50.0, weight: 0.3, color: "#ec4899", text: "¡SUPER JACKPOT!" },
];

router.get("/slices", (_req, res) => {
  res.json({ slices: ROULETTE_SLICES });
});

router.post("/spin", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);

  if (betAmount < 100000) {
    return res.status(400).json({ error: "La apuesta mínima es de 100,000 monedas (100K)" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (user.coins < betAmount) {
    return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.coins.toLocaleString("es-MX")} monedas.` });
  }

  // 1. Selección ponderada del segmento ganador
  const totalWeight = ROULETTE_SLICES.reduce((sum, s) => sum + s.weight, 0);
  const randomVal = Math.random() * totalWeight;
  let accumulated = 0;
  let selectedSlice = ROULETTE_SLICES[0];

  for (const slice of ROULETTE_SLICES) {
    accumulated += slice.weight;
    if (randomVal < accumulated) {
      selectedSlice = slice;
      break;
    }
  }

  const payoutCoins = Math.floor(betAmount * selectedSlice.multiplier);
  const netChange = payoutCoins - betAmount;

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Registrar asiento contable
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: netChange,
          type: "REWARD",
          status: "COMPLETED",
          description: `Ruleta de la Suerte (${selectedSlice.label}) - Apuesta: ${betAmount.toLocaleString("es-MX")}, Pagado: ${payoutCoins.toLocaleString("es-MX")}`,
        },
      });

      // Actualizar monedas del usuario
      const updated = await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: netChange } },
        select: { coins: true },
      });

      return updated;
    });

    return res.json({
      success: true,
      sliceIndex: selectedSlice.index,
      slice: selectedSlice,
      betAmount,
      payoutCoins,
      netChange,
      newBalance: updatedUser.coins,
    });
  } catch (error: any) {
    console.error("Error al procesar giro de Ruleta:", error);
    return res.status(500).json({ error: "Error al procesar el resultado de la ruleta" });
  }
});

export default router;
