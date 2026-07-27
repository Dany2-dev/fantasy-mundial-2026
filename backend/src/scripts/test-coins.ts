import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { grantFaucet } from '../services/faucet';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING COIN INTEGRATION TESTS ---');

  try {
    // Inicializar datos de prueba
    console.log('Seeding test players and user accounts...');
    
    // Crear competencia de prueba si no existe
    const comp = await prisma.competition.upsert({
      where: { fotmobId: 9999 },
      update: {},
      create: {
        fotmobId: 9999,
        name: 'Liga de Prueba',
        ccode: 'TST',
        type: 'cup',
        priority: 1,
        isCurrent: true,
      },
    });

    // Crear dos equipos de prueba
    const team1 = await prisma.team.create({
      data: { competitionId: comp.id, fotmobId: 999901, name: 'Equipo T1', flag: '🏳️', group: 'A' },
    });
    const team2 = await prisma.team.create({
      data: { competitionId: comp.id, fotmobId: 999902, name: 'Equipo T2', flag: '🏳️', group: 'A' },
    });

    // Crear dos jugadores de prueba
    const playerA = await prisma.player.create({
      data: {
        competitionId: comp.id,
        teamId: team1.id,
        fotmobId: 99991,
        name: 'Jugador A',
        position: 'DEL',
        rating: 85,
        basePrice: 10200,
      },
    });

    const playerB = await prisma.player.create({
      data: {
        competitionId: comp.id,
        teamId: team2.id,
        fotmobId: 99992,
        name: 'Jugador B',
        position: 'MED',
        rating: 80,
        basePrice: 9600,
      },
    });

    // Crear dos usuarios de prueba
    const userA = await prisma.user.create({
      data: {
        email: `usera-${Date.now()}@test.com`,
        name: 'User A',
        password: 'hash_password',
        coins: 1000,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `userb-${Date.now()}@test.com`,
        name: 'User B',
        password: 'hash_password',
        coins: 1000,
      },
    });

    // Crear una liga de prueba
    const league = await prisma.league.create({
      data: {
        name: 'Liga Test Concurrencia',
        inviteCode: `tst-${crypto.randomBytes(4).toString('hex')}`,
        ownerId: userA.id,
        competitionId: comp.id,
      },
    });

    // Asignar jugadores en OwnedPlayer
    const ownedA = await prisma.ownedPlayer.create({
      data: {
        userId: userA.id,
        leagueId: league.id,
        playerId: playerA.id,
        clause: 12000,
      },
    });

    const ownedB = await prisma.ownedPlayer.create({
      data: {
        userId: userB.id,
        leagueId: league.id,
        playerId: playerB.id,
        clause: 10000,
      },
    });

    console.log('✔ Test data seeded successfully.');

    // -------------------------------------------------------------
    // PRUEBA 1: Concurrencia de TradeOffers Cruzadas (Evitar Deadlocks)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Simultaneous Cross-Trade Acceptance (Deadlock Immunity) ---');

    // Crear Oferta 1: User A ofrece Player A a User B por Player B + 100 monedas
    const trade1 = await prisma.tradeOffer.create({
      data: {
        leagueId: league.id,
        fromUserId: userA.id,
        toUserId: userB.id,
        offeredPlayerId: playerA.id,
        requestedPlayerId: playerB.id,
        coins: 100,
        status: 'pending',
      },
    });

    // Crear Oferta 2: User B ofrece Player B a User A por Player A + 50 monedas
    const trade2 = await prisma.tradeOffer.create({
      data: {
        leagueId: league.id,
        fromUserId: userB.id,
        toUserId: userA.id,
        offeredPlayerId: playerB.id,
        requestedPlayerId: playerA.id,
        coins: 50,
        status: 'pending',
      },
    });

    // Función que simula la lógica de aceptación de la oferta de intercambio
    const executeAcceptTrade = async (tradeId: string, recipientId: string) => {
      return await prisma.$transaction(async (tx) => {
        const trade = await tx.tradeOffer.findUnique({ where: { id: tradeId } });
        if (!trade || trade.status !== 'pending') {
          throw new Error('Oferta de intercambio ya no está disponible.');
        }

        // 1. Bloquear Users en orden alfabético
        const sortedUserIds = [trade.fromUserId, trade.toUserId].sort();
        for (const uid of sortedUserIds) {
          await tx.$queryRaw`SELECT id, coins FROM "User" WHERE id = ${uid} FOR UPDATE`;
        }

        // 2. Bloquear OwnedPlayer en orden playerId ASC
        const playerIdsToLock = [trade.offeredPlayerId, trade.requestedPlayerId].sort((a, b) => a - b);
        const ownedRows = await tx.$queryRaw<any[]>`
          SELECT id, "userId", "playerId" FROM "OwnedPlayer" 
          WHERE "leagueId" = ${trade.leagueId} AND "playerId" IN (${playerIdsToLock[0]}, ${playerIdsToLock[1]})
          ORDER BY "playerId" ASC
          FOR UPDATE
        `;

        const lockedOffered = ownedRows.find(r => r.playerId === trade.offeredPlayerId);
        const lockedRequested = ownedRows.find(r => r.playerId === trade.requestedPlayerId);

        if (!lockedOffered || lockedOffered.userId !== trade.fromUserId) {
          await tx.tradeOffer.update({ where: { id: tradeId }, data: { status: 'rejected' } });
          throw new Error('El proponente ya no posee la carta ofrecida.');
        }

        if (!lockedRequested || lockedRequested.userId !== trade.toUserId) {
          await tx.tradeOffer.update({ where: { id: tradeId }, data: { status: 'rejected' } });
          throw new Error('Ya no posees la carta solicitada.');
        }

        // 3. Bloquear TradeOffer
        const trades = await tx.$queryRaw<any[]>`
          SELECT id, status FROM "TradeOffer" WHERE id = ${tradeId} FOR UPDATE
        `;
        if (trades[0].status !== 'pending') {
          throw new Error('Oferta de intercambio ya resuelta.');
        }

        // 4. Transferir monedas
        if (trade.coins > 0) {
          const offerer = await tx.user.findUnique({ where: { id: trade.fromUserId }, select: { coins: true } });
          if (!offerer || offerer.coins < trade.coins) {
            throw new Error('Saldo insuficiente.');
          }
          await tx.user.update({ where: { id: trade.fromUserId }, data: { coins: { decrement: trade.coins } } });
          await tx.user.update({ where: { id: trade.toUserId }, data: { coins: { increment: trade.coins } } });
        }

        // 5. Transferir propiedad de cartas
        await tx.ownedPlayer.update({ where: { id: lockedOffered.id }, data: { userId: trade.toUserId } });
        await tx.ownedPlayer.update({ where: { id: lockedRequested.id }, data: { userId: trade.fromUserId } });

        // 6. Aceptar Trade
        await tx.tradeOffer.update({ where: { id: tradeId }, data: { status: 'accepted' } });

        // 7. Rechazar ofertas solapadas
        await tx.tradeOffer.updateMany({
          where: {
            id: { not: tradeId },
            leagueId: trade.leagueId,
            status: 'pending',
            OR: [
              { offeredPlayerId: trade.offeredPlayerId },
              { offeredPlayerId: trade.requestedPlayerId },
              { requestedPlayerId: trade.offeredPlayerId },
              { requestedPlayerId: trade.requestedPlayerId }
            ]
          },
          data: { status: 'rejected' }
        });

        return 'trade_accepted';
      });
    };

    console.log('Firing both trade acceptances simultaneously...');
    const results = await Promise.allSettled([
      executeAcceptTrade(trade1.id, userB.id),
      executeAcceptTrade(trade2.id, userA.id),
    ]);

    let successCount = 0;
    let rejectedCount = 0;

    results.forEach((res, index) => {
      if (res.status === 'fulfilled') {
        successCount++;
        console.log(`Trade ${index + 1} Succeeded: ${res.value}`);
      } else {
        rejectedCount++;
        console.log(`Trade ${index + 1} Correctly Rejected/Failed: ${res.reason.message}`);
      }
    });

    if (successCount === 1 && rejectedCount === 1) {
      console.log('✔ PASS: One trade succeeded, the other was safely rejected/cancelled without database deadlocks!');
    } else {
      throw new Error(`FAIL: Expected 1 success and 1 rejection, got ${successCount} success and ${rejectedCount} rejections.`);
    }

    // -------------------------------------------------------------
    // PRUEBA 2: Pagos Huérfanos y RefundJob
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Orphan Payments and RefundJob Insertion ---');

    // Registrar una orden de pago sin userId (usuario eliminado/GDPR)
    const stripeSessionId = `sess_test_${Date.now()}`;
    const paymentOrder = await prisma.paymentOrder.create({
      data: {
        userId: null,
        stripeSessionId,
        amountPaidCents: 499,
        coinsAmount: 5000,
        status: 'PENDING',
      },
    });

    console.log(`Created pending PaymentOrder with userId = null, session: ${stripeSessionId}`);

    // Simular la lógica de webhook para pago huérfano
    const processWebhookOrphan = async (sessId: string) => {
      return await prisma.$transaction(async (tx) => {
        const tempOrder = await tx.paymentOrder.findUnique({
          where: { stripeSessionId: sessId },
          select: { id: true, userId: true, coinsAmount: true, amountPaidCents: true, status: true }
        });

        if (!tempOrder) {
          throw new Error('Orden no encontrada.');
        }

        if (!tempOrder.userId) {
          // Pago huérfano detectado: marcar como FAILED
          await tx.paymentOrder.update({
            where: { id: tempOrder.id },
            data: { status: 'FAILED' },
          });

          // Crear RefundJob
          await tx.refundJob.create({
            data: {
              stripeSessionId: sessId,
              paymentIntentId: 'pi_test_123',
              amountPaidCents: tempOrder.amountPaidCents,
              status: 'PENDING',
            }
          });
          return 'marked_failed_refund_job_created';
        }
      });
    };

    const webhookResult = await processWebhookOrphan(stripeSessionId);
    console.log(`Webhook simulated execution result: ${webhookResult}`);

    // Verificar en DB
    const finalOrder = await prisma.paymentOrder.findUnique({ where: { id: paymentOrder.id } });
    const refundJob = await prisma.refundJob.findUnique({ where: { stripeSessionId } });

    if (finalOrder?.status === 'FAILED' && refundJob?.status === 'PENDING') {
      console.log('✔ PASS: PaymentOrder marked as FAILED and RefundJob created in PENDING state!');
    } else {
      throw new Error(`FAIL: Unexpected states. Order: ${finalOrder?.status}, RefundJob: ${refundJob?.status}`);
    }

    // -------------------------------------------------------------
    // PRUEBA 3: Límites de Faucets Semanales y Otorgamiento Parcial
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Weekly Faucet Limit & Partial Grants ---');
    const weekKey = '2026-W30';
    const referencePrefix = `faucet-test-${Date.now()}`;

    // Limpiar límites previos de la semana para el usuario A
    await prisma.faucetLimit.deleteMany({
      where: { userId: userA.id, periodKey: weekKey },
    });

    console.log('Claiming first reward of 2000 coins...');
    // Primer reclamo: 2000 coins
    const grant1 = await prisma.$transaction(async (tx) => {
      return await grantFaucet(
        tx,
        userA.id,
        () => 2000,
        'REWARD',
        weekKey,
        `${referencePrefix}-1`
      );
    });
    console.log(`First grant result: success=${grant1.success}, amount=${grant1.coinsGranted}`);

    console.log('Claiming second reward of 2000 coins (exceeds weekly limit of 3500)...');
    // Segundo reclamo: 2000 coins (superaría el límite total de 3500 por 500, debería otorgar solo 1500)
    const grant2 = await prisma.$transaction(async (tx) => {
      return await grantFaucet(
        tx,
        userA.id,
        () => 2000,
        'REWARD',
        weekKey,
        `${referencePrefix}-2`
      );
    });
    console.log(`Second grant result: success=${grant2.success}, amount=${grant2.coinsGranted}`);

    console.log('Claiming third reward of 500 coins (already at limit)...');
    // Tercer reclamo: 500 coins (debería retornar error / 0 granted)
    const grant3 = await prisma.$transaction(async (tx) => {
      return await grantFaucet(
        tx,
        userA.id,
        () => 500,
        'REWARD',
        weekKey,
        `${referencePrefix}-3`
      );
    });
    console.log(`Third grant result: success=${grant3.success}, amount=${grant3.coinsGranted}, error=${grant3.error}`);

    // Validar en DB
    const finalLimit = await prisma.faucetLimit.findUnique({
      where: { userId_periodKey: { userId: userA.id, periodKey: weekKey } },
    });

    if (
      grant1.coinsGranted === 2000 &&
      grant2.coinsGranted === 1500 &&
      grant3.coinsGranted === 0 &&
      finalLimit?.amount === 3500
    ) {
      console.log('✔ PASS: Weekly limit enforced to exactly 3,500 coins with correct partial reward payouts!');
    } else {
      throw new Error(`FAIL: Unexpected faucet limit amounts: grant1=${grant1.coinsGranted}, grant2=${grant2.coinsGranted}, grant3=${grant3.coinsGranted}, limitAmount=${finalLimit?.amount}`);
    }

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY! ---');
  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILED:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
