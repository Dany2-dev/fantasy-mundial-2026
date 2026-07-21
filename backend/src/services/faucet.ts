import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const WEEKLY_LIMIT = 3500;

/**
 * Otorgamiento centralizado de grifos (Faucets).
 * Garantiza locks ordenados: User -> FaucetLimit -> SystemAccount.
 * Utiliza ON CONFLICT DO NOTHING para evitar race conditions al crear FaucetLimit.
 */
export async function grantFaucet(
  tx: Prisma.TransactionClient,
  userId: string,
  computeAmount: (currentCoins: number) => number,
  type: 'REWARD',
  weekKey: string,
  referenceId: string
): Promise<{ success: boolean; coinsGranted: number; error?: string }> {

  // 1. PROTOCOLO DE LOCKS: Bloquear User primero
  const users = await tx.$queryRaw<any[]>`
    SELECT id, coins FROM "User" WHERE id = ${userId} FOR UPDATE
  `;
  if (!users[0]) {
    throw new Error('Usuario no encontrado.');
  }

  // Evaluar el monto del faucet de forma segura con el saldo bloqueado
  const resolvedAmount = computeAmount(users[0].coins);

  // 2. PROTOCOLO DE LOCKS: Bloquear FaucetLimit (F antes que S)
  const tempId = crypto.randomUUID();
  await tx.$executeRaw`
    INSERT INTO "FaucetLimit" ("id", "userId", "periodKey", "amount", "createdAt", "updatedAt")
    VALUES (${tempId}, ${userId}, ${weekKey}, 0, NOW(), NOW())
    ON CONFLICT ("userId", "periodKey") DO NOTHING
  `;

  const limits = await tx.$queryRaw<any[]>`
    SELECT id, amount FROM "FaucetLimit" 
    WHERE "userId" = ${userId} AND "periodKey" = ${weekKey} 
    FOR UPDATE
  `;
  const currentLimit = limits[0];
  if (!currentLimit) {
    throw new Error('No se pudo inicializar el límite semanal (FaucetLimit).');
  }

  // 3. PROTOCOLO DE LOCKS: Bloquear SystemAccount (S después que F)
  const systemAccounts = await tx.$queryRaw<any[]>`
    SELECT id, balance FROM "SystemAccount" 
    WHERE id = 'SYSTEM_EMISSION' 
    FOR UPDATE
  `;
  if (!systemAccounts[0]) {
    throw new Error('Cuenta SYSTEM_EMISSION no inicializada.');
  }

  // Calcular otorgamiento parcial
  const remaining = Math.max(0, WEEKLY_LIMIT - currentLimit.amount);
  const grantedAmount = Math.min(resolvedAmount, remaining);

  if (grantedAmount <= 0) {
    return { success: false, coinsGranted: 0, error: 'Límite semanal alcanzado.' };
  }

  // 4. Registrar partida doble en Ledger (CoinTransaction)
  // Pata 1: Abono al usuario
  await tx.coinTransaction.create({
    data: {
      userId,
      amount: grantedAmount,
      type,
      referenceId,
      status: 'COMPLETED',
      description: `Recompensa de faucet - ${type}`,
    },
  });

  // Pata 2: Cargo a la cuenta de emisión del sistema
  await tx.coinTransaction.create({
    data: {
      systemAccountId: 'SYSTEM_EMISSION',
      amount: -grantedAmount,
      type,
      referenceId,
      status: 'COMPLETED',
      description: `Emisión de faucet para usuario ${userId}`,
    },
  });

  // 5. Actualizar cachés de saldo en User y SystemAccount
  await tx.user.update({
    where: { id: userId },
    data: { coins: { increment: grantedAmount } },
  });

  await tx.systemAccount.update({
    where: { id: 'SYSTEM_EMISSION' },
    data: { balance: { decrement: grantedAmount } },
  });

  // 6. Incrementar el acumulado semanal de faucets
  await tx.faucetLimit.update({
    where: { id: currentLimit.id },
    data: { amount: { increment: grantedAmount } },
  });

  return { success: true, coinsGranted: grantedAmount };
}

/**
 * Reclama la recompensa diaria de inicio de sesión.
 * Incluye check optimista, idempotencia a nivel de constraint (P2002) y subsidio del 15% basado en Gini.
 */
export const claimDailyReward = async (
  userId: string,
  leagueId: string,
  weekKey: string
): Promise<{ success: boolean; coinsGranted?: number; error?: string }> => {
  const BASE_REWARD_AMOUNT = 100;
  const todayStr = new Date().toISOString().slice(0, 10);
  const referenceId = `daily-login-${todayStr}`;

  try {
    return await prisma.$transaction(async (tx) => {
      // Check previo optimista (no bloqueante para responder rápido si ya se cobró)
      const alreadyClaimed = await tx.coinTransaction.findFirst({
        where: { userId, type: 'REWARD', referenceId },
      });
      if (alreadyClaimed) {
        return { success: false, error: 'Ya has reclamado tu recompensa de inicio de sesión de hoy.' };
      }

      // Obtener estadísticas macroeconómicas de la liga
      const activeStats = await tx.leagueStats.findFirst({
        where: { leagueId },
        orderBy: { calculatedAt: 'desc' },
      });

      // Ejecutar otorgamiento dinámico bajo locks ordenados
      const result = await grantFaucet(
        tx,
        userId,
        (currentCoins) => {
          if (activeStats && activeStats.giniIndex > 0.45 && currentCoins < activeStats.bottom25PercentileCoinsThreshold) {
            // Aplicar subsidio del 15% (1.15x) sobre saldo bloqueado
            return Math.round(BASE_REWARD_AMOUNT * 1.15);
          }
          return BASE_REWARD_AMOUNT;
        },
        'REWARD',
        weekKey,
        referenceId
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, coinsGranted: result.coinsGranted };
    });
  } catch (error: any) {
    // Si la base de datos aborta con P2002 (violación de clave única por click concurrente)
    if (error.code === 'P2002') {
      return { success: false, error: 'Ya has reclamado tu recompensa de inicio de sesión de hoy.' };
    }
    console.error('Error al otorgar Daily Reward:', error.message);
    return { success: false, error: 'Error interno del servidor.' };
  }
};
