import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

export interface Card {
  suit: "♠" | "♥" | "♦" | "♣";
  value: string;
  numValue: number;
}

const SUITS: ("♠" | "♥" | "♦" | "♣")[] = ["♠", "♥", "♦", "♣"];
const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function drawCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const valStr = VALUES[Math.floor(Math.random() * VALUES.length)];
  let numValue = parseInt(valStr, 10);
  if (["J", "Q", "K"].includes(valStr)) numValue = 10;
  if (valStr === "A") numValue = 11;
  return { suit, value: valStr, numValue };
}

function calculateHandValue(hand: Card[]): number {
  let val = 0;
  let aces = 0;
  for (const c of hand) {
    val += c.numValue;
    if (c.value === "A") aces += 1;
  }
  while (val > 21 && aces > 0) {
    val -= 10;
    aces -= 1;
  }
  return val;
}

router.post("/start", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);

  if (betAmount < 100000) {
    return res.status(400).json({ error: "La apuesta mínima es de 100,000 monedas (100K)" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  if (user.coins < betAmount) {
    return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.coins.toLocaleString("es-MX")} monedas.` });
  }

  const playerHand: Card[] = [drawCard(), drawCard()];
  const dealerHand: Card[] = [drawCard(), drawCard()];

  const playerVal = calculateHandValue(playerHand);

  // Chequeo de Blackjack natural (21 en las dos primeras cartas)
  if (playerVal === 21) {
    const winnings = Math.floor(betAmount * 2.5);
    const netGain = winnings - betAmount;

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: netGain,
            type: "REWARD",
            status: "COMPLETED",
            description: `Blackjack 21 (¡BLACKJACK!) - Apuesta: ${betAmount.toLocaleString("es-MX")}, Ganado: ${winnings.toLocaleString("es-MX")}`,
          },
        });

        return await tx.user.update({
          where: { id: userId },
          data: { coins: { increment: netGain } },
          select: { coins: true },
        });
      });

      return res.json({
        status: "BLACKJACK",
        playerHand,
        dealerHand,
        playerValue: 21,
        dealerValue: calculateHandValue(dealerHand),
        winnings,
        newBalance: updatedUser.coins,
      });
    } catch (err: any) {
      console.error("Error al procesar Blackjack:", err);
      return res.status(500).json({ error: "Error al acreditar tu victoria de Blackjack" });
    }
  }

  return res.json({
    status: "PLAYING",
    playerHand,
    dealerHand: [dealerHand[0], { suit: "♠", value: "?", numValue: 0 }],
    realDealerHand: dealerHand,
    playerValue: playerVal,
  });
});

router.post("/hit", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);
  const playerHand: Card[] = req.body.playerHand || [];
  const realDealerHand: Card[] = req.body.realDealerHand || [];

  if (betAmount < 100 || playerHand.length < 2) {
    return res.status(400).json({ error: "Partida inválida" });
  }

  const newCard = drawCard();
  const updatedPlayerHand = [...playerHand, newCard];
  const playerVal = calculateHandValue(updatedPlayerHand);

  if (playerVal > 21) {
    // Bust: Pierde la apuesta
    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: -betAmount,
            type: "REWARD",
            status: "COMPLETED",
            description: `Blackjack 21 (Se pasó de 21) - Apuesta: ${betAmount.toLocaleString("es-MX")}`,
          },
        });

        return await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: betAmount } },
          select: { coins: true },
        });
      });

      return res.json({
        status: "BUST",
        playerHand: updatedPlayerHand,
        dealerHand: realDealerHand,
        playerValue: playerVal,
        dealerValue: calculateHandValue(realDealerHand),
        newBalance: updatedUser.coins,
      });
    } catch (err: any) {
      console.error("Error en Bust Blackjack:", err);
      return res.status(500).json({ error: "Error al procesar el resultado" });
    }
  }

  return res.json({
    status: "PLAYING",
    playerHand: updatedPlayerHand,
    dealerHand: [realDealerHand[0], { suit: "♠", value: "?", numValue: 0 }],
    realDealerHand,
    playerValue: playerVal,
  });
});

router.post("/stand", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const betAmount = Math.floor(Number(req.body.betAmount) || 0);
  const playerHand: Card[] = req.body.playerHand || [];
  const realDealerHand: Card[] = req.body.realDealerHand || [];

  if (betAmount < 100 || playerHand.length < 2) {
    return res.status(400).json({ error: "Partida inválida" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const playerVal = calculateHandValue(playerHand);
  const currentDealerHand = [...realDealerHand];

  // El Crupier pide cartas hasta sumar al menos 17
  while (calculateHandValue(currentDealerHand) < 17) {
    currentDealerHand.push(drawCard());
  }

  const dealerVal = calculateHandValue(currentDealerHand);

  let gameResult: "WIN" | "LOSE" | "PUSH" = "LOSE";
  let netGain = 0;
  let winnings = 0;

  if (dealerVal > 21 || playerVal > dealerVal) {
    gameResult = "WIN";
    winnings = betAmount * 2;
    netGain = betAmount;
  } else if (playerVal === dealerVal) {
    gameResult = "PUSH";
    winnings = betAmount;
    netGain = 0;
  } else {
    gameResult = "LOSE";
    netGain = -betAmount;
    winnings = 0;
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (netGain !== 0) {
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: netGain,
            type: "REWARD",
            status: "COMPLETED",
            description: `Blackjack 21 (${gameResult === "WIN" ? "Victoria" : "Derrota"}) - Apuesta: ${betAmount.toLocaleString("es-MX")}, Resultado: ${winnings.toLocaleString("es-MX")}`,
          },
        });

        return await tx.user.update({
          where: { id: userId },
          data: { coins: { increment: netGain } },
          select: { coins: true },
        });
      }
      return user;
    });

    return res.json({
      status: gameResult,
      playerHand,
      dealerHand: currentDealerHand,
      playerValue: playerVal,
      dealerValue: dealerVal,
      winnings,
      newBalance: updatedUser.coins,
    });
  } catch (err: any) {
    console.error("Error al procesar Stand en Blackjack:", err);
    return res.status(500).json({ error: "Error al procesar el resultado de la mano" });
  }
});

export default router;
