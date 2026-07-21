import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2023-10-16' as any,
});

const MAX_REFUND_ATTEMPTS = 5;

/**
 * Procesa todos los reembolsos de pagos huérfanos pendientes en la base de datos de manera distribuida.
 * Separa la adquisición de locks de la llamada externa de Stripe para prevenir timeouts de transacción.
 */
export const processPendingRefunds = async (): Promise<void> => {
  try {
    // FASE 1: Reclamar el lote - Transacción interactiva corta (solo base de datos, sin latencia de red)
    const claimedJobs = await prisma.$transaction(async (tx) => {
      const jobs = await tx.$queryRaw<any[]>`
        SELECT id, "stripeSessionId", "paymentIntentId", "amountPaidCents", attempts
        FROM "RefundJob"
        WHERE status = 'PENDING' AND attempts < ${MAX_REFUND_ATTEMPTS}
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `;

      if (jobs.length === 0) {
        return [];
      }

      // Marcar de forma atómica como PROCESSING para que ningún otro worker distribuido los tome
      await tx.refundJob.updateMany({
        where: { id: { in: jobs.map((j) => j.id) } },
        data: { status: 'PROCESSING' },
      });

      return jobs;
    }); // La transacción cierra y libera los locks de Postgres en milisegundos

    if (claimedJobs.length === 0) {
      return;
    }

    // FASE 2: Ejecutar los reembolsos a Stripe FUERA de la transacción interactiva
    for (const job of claimedJobs) {
      if (!job.paymentIntentId) {
        await prisma.refundJob.update({
          where: { id: job.id },
          data: { status: 'FAILED' },
        });
        continue;
      }

      try {
        // Ejecución de la API externa con llave de idempotencia
        await stripe.refunds.create(
          { payment_intent: job.paymentIntentId },
          { idempotencyKey: `refund-${job.stripeSessionId}` }
        );

        // Si tiene éxito, actualizar individualmente a COMPLETED
        await prisma.refundJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        });

        console.log(`Reembolso completado para la sesión ${job.stripeSessionId}`);
      } catch (error: any) {
        const nextAttempts = job.attempts + 1;
        
        // Reconciliación si el reembolso ya fue procesado
        if (error.raw?.message?.includes('already been refunded') || error.raw?.code === 'charge_already_refunded') {
          await prisma.refundJob.update({
            where: { id: job.id },
            data: { status: 'COMPLETED' },
          });
          console.log(`Reembolso ya procesado previamente para la sesión ${job.stripeSessionId}`);
          continue;
        }

        // Si se alcanza el límite de intentos, pasa a revisión manual
        if (nextAttempts >= MAX_REFUND_ATTEMPTS) {
          await prisma.refundJob.update({
            where: { id: job.id },
            data: { 
              status: 'NEEDS_MANUAL_REVIEW',
              attempts: nextAttempts
            },
          });
          console.error(`CRÍTICO: RefundJob ${job.id} requiere revisión manual.`);
        } else {
          // Si el fallo es temporal, se regresa al estado PENDING para que vuelva a ser reclamado
          await prisma.refundJob.update({
            where: { id: job.id },
            data: { 
              status: 'PENDING',
              attempts: nextAttempts 
            },
          });
          console.warn(`Intento fallido #${nextAttempts} para RefundJob ${job.id}: ${error.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error en el worker de reembolsos:', error.message);
  }
};

/**
 * Tarea programada de seguridad (Reconciliation Cron):
 * Recupera aquellos trabajos que hayan quedado atascados en 'PROCESSING' por más de 15 minutos
 * (por ejemplo, si el servidor se apaga a mitad de la Fase 2) y los regresa a 'PENDING'.
 */
export const recoverStuckProcessingJobs = async (): Promise<void> => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  try {
    const result = await prisma.refundJob.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: fifteenMinutesAgo }
      },
      data: {
        status: 'PENDING'
      }
    });
    
    if (result.count > 0) {
      console.log(`Recuperados ${result.count} trabajos de reembolso atascados en estado PROCESSING.`);
    }
  } catch (error: any) {
    console.error('Error al recuperar trabajos de reembolso atascados:', error.message);
  }
};
