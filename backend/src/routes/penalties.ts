import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

export interface PenaltyLevel {
  level: number;
  multiplier: number;
  goalChance: number;
}

// Generador matemático de 100 Niveles
export const PENALTY_LEVELS: PenaltyLevel[] = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1;

  let multiplier: number;
  if (level === 1) multiplier = 1.25;
  else if (level <= 5) multiplier = Number((1.25 + (level - 1) * 0.45).toFixed(2));
  else if (level <= 10) multiplier = Number((3.1 + (level - 5) * 1.1).toFixed(2));
  else if (level <= 25) multiplier = Number((8.5 + (level - 10) * 4.4).toFixed(1));
  else if (level <= 50) multiplier = Math.round(75 + Math.pow(level - 25, 2.4) * 0.9);
  else if (level <= 75) multiplier = Math.round(2500 + Math.pow(level - 50, 2.8) * 4.2);
  else multiplier = Math.round(50000 + Math.pow(level - 75, 3.15) * 60);

  if (level === 100) multiplier = 1000000;

  let goalChance: number;
  if (level <= 5) goalChance = 90 - (level - 1) * 2.5;
  else if (level <= 15) goalChance = 80 - (level - 5) * 1.5;
  else if (level <= 30) goalChance = 65 - (level - 15) * 1.0;
  else if (level <= 50) goalChance = 50 - (level - 30) * 0.85;
  else if (level <= 75) goalChance = 33 - (level - 50) * 0.6;
  else goalChance = Math.max(5, Math.round(18 - (level - 75) * 0.52));

  return { level, multiplier, goalChance: Math.round(goalChance) };
});

export const PENALTY_MULTIPLIERS = PENALTY_LEVELS.map((l) => l.multiplier);

router.post("/shoot", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);
  const direction = String(req.body.direction || "center").toLowerCase();
  const currentRound = Math.max(1, Math.floor(Number(req.body.currentRound) || 1));

  if (!["left", "center", "right"].includes(direction)) {
    return res.status(400).json({ error: "Dirección de tiro inválida (left, center, right)" });
  }

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

  // Obtener info del nivel actual (1 a 100)
  const levelIndex = Math.min(Math.max(1, currentRound) - 1, 99);
  const levelInfo = PENALTY_LEVELS[levelIndex];
  const chance = levelInfo.goalChance;
  const isGoal = Math.random() * 100 < chance;

  const directions = ["left", "center", "right"];
  let keeperDived = direction;

  if (isGoal) {
    const otherDirections = directions.filter((d) => d !== direction);
    keeperDived = otherDirections[Math.floor(Math.random() * otherDirections.length)];

    const multiplier = levelInfo.multiplier;
    const currentWinnings = Math.floor(betAmount * multiplier);

    return res.json({
      isGoal: true,
      keeperDived,
      shotDirection: direction,
      currentRound,
      nextRound: Math.min(currentRound + 1, 100),
      multiplier,
      currentWinnings,
    });
  } else {
    keeperDived = direction;

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: -betAmount,
            type: "REWARD",
            status: "COMPLETED",
            description: `Tanda de Penaltis (Atajada en Nivel ${currentRound}) - Apuesta: ${betAmount.toLocaleString("es-MX")}`,
          },
        });

        return await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: betAmount } },
          select: { coins: true },
        });
      });

      return res.json({
        isGoal: false,
        keeperDived,
        shotDirection: direction,
        currentRound,
        newBalance: updatedUser.coins,
      });
    } catch (err: any) {
      console.error("Error al registrar fallo de penal:", err);
      return res.status(500).json({ error: "Error al procesar el resultado del penal" });
    }
  }
});

router.post("/cashout", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);
  const winnings = Math.floor(Number(req.body.winnings) || 0);
  const roundCompleted = Math.max(1, Math.floor(Number(req.body.roundCompleted) || 1));

  if (betAmount < 100000 || winnings <= betAmount) {
    return res.status(400).json({ error: "Solicitud de Cash Out inválida" });
  }

  const netGain = winnings - betAmount;

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: netGain,
          type: "REWARD",
          status: "COMPLETED",
          description: `Tanda de Penaltis (Retiro Cash Out Nivel ${roundCompleted}) - Ganancia: +${netGain.toLocaleString("es-MX")} Coins`,
        },
      });

      return await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: netGain } },
        select: { coins: true },
      });
    });

    return res.json({
      success: true,
      winnings,
      netGain,
      newBalance: updatedUser.coins,
    });
  } catch (error: any) {
    console.error("Error en Cash Out de penaltis:", error);
    return res.status(500).json({ error: "Error al acreditar tus ganancias del retiro" });
  }
});

export default router;
