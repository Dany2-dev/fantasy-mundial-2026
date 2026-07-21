import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Se inicializa Stripe con la clave secreta de las variables de entorno
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2023-10-16' as any,
});

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'dummy_secret';

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // req.body contiene el buffer crudo gracias a express.raw()
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`Error en validación de webhook de Stripe:`, err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const stripeSessionId = session.id;

    try {
      let orphanPayment = false;
      let paymentIntentId = session.payment_intent as string;

      await prisma.$transaction(async (tx) => {
        // 1. Obtener la orden de pago de forma no bloqueante (solo lectura)
        const tempOrder = await tx.paymentOrder.findUnique({
          where: { stripeSessionId },
          select: { id: true, userId: true, coinsAmount: true, amountPaidCents: true, status: true }
        });

        if (!tempOrder) {
          throw new Error(`Orden no encontrada para Session ID: ${stripeSessionId}`);
        }

        // Si ya está completada o marcada como fallida terminamos
        if (tempOrder.status === 'COMPLETED' || tempOrder.status === 'FAILED') {
          return;
        }

        // CONTROL DE PAGO HUÉRFANO (Si el userId es null debido a SetNull por GDPR/Baneo)
        if (!tempOrder.userId) {
          orphanPayment = true;
          await tx.paymentOrder.update({
            where: { id: tempOrder.id },
            data: { status: 'FAILED' },
          });
          // Registrar job persistente para que el worker procese el reembolso
          await tx.refundJob.create({
            data: {
              stripeSessionId,
              paymentIntentId,
              amountPaidCents: tempOrder.amountPaidCents,
              status: 'PENDING',
            }
          });
          return;
        }

        // REGLA DE LOCKING 1: Bloquear fila del User primero
        const users = await tx.$queryRaw<any[]>`
          SELECT id, coins FROM "User" 
          WHERE id = ${tempOrder.userId} 
          FOR UPDATE
        `;
        const user = users[0];
        if (!user) {
          orphanPayment = true;
          await tx.paymentOrder.update({
            where: { id: tempOrder.id },
            data: { status: 'FAILED' },
          });
          await tx.refundJob.create({
            data: {
              stripeSessionId,
              paymentIntentId,
              amountPaidCents: tempOrder.amountPaidCents,
              status: 'PENDING',
            }
          });
          return;
        }

        // REGLA DE LOCKING 2: Bloquear PaymentOrder (P antes que S)
        const orders = await tx.$queryRaw<any[]>`
          SELECT id, status FROM "PaymentOrder" 
          WHERE id = ${tempOrder.id} 
          FOR UPDATE
        `;
        const paymentOrder = orders[0];
        if (paymentOrder.status === 'COMPLETED' || paymentOrder.status === 'FAILED') {
          return;
        }

        // REGLA DE LOCKING 3: Bloquear SystemAccount (S después que P)
        const systemAccounts = await tx.$queryRaw<any[]>`
          SELECT id, balance FROM "SystemAccount" 
          WHERE id = 'SYSTEM_EMISSION' 
          FOR UPDATE
        `;
        if (!systemAccounts[0]) {
          throw new Error(`Cuenta SYSTEM_EMISSION no inicializada en la base de datos.`);
        }

        // 2. Registrar partida doble en el Ledger (CoinTransaction)
        await tx.coinTransaction.create({
          data: {
            userId: tempOrder.userId,
            amount: tempOrder.coinsAmount,
            type: 'BUY',
            referenceId: paymentOrder.id,
            status: 'COMPLETED',
            description: `Compra Stripe - ${tempOrder.coinsAmount.toLocaleString()} Coins`,
          },
        });

        await tx.coinTransaction.create({
          data: {
            systemAccountId: 'SYSTEM_EMISSION',
            amount: -tempOrder.coinsAmount,
            type: 'BUY',
            referenceId: paymentOrder.id,
            status: 'COMPLETED',
            description: `Emisión de Coins para el usuario ${tempOrder.userId}`,
          },
        });

        // 3. Actualizar cachés de saldo de usuario y del sistema
        await tx.user.update({
          where: { id: tempOrder.userId },
          data: { coins: { increment: tempOrder.coinsAmount } },
        });

        await tx.systemAccount.update({
          where: { id: 'SYSTEM_EMISSION' },
          data: { balance: { decrement: tempOrder.coinsAmount } },
        });

        // 4. Confirmar orden de pago a COMPLETED
        await tx.paymentOrder.update({
          where: { id: paymentOrder.id },
          data: { status: 'COMPLETED' },
        });
      });

      // Si fue pago huérfano, procesar reembolso asíncrono
      if (orphanPayment) {
        console.error(`Pago huérfano detectado en la sesión ${stripeSessionId}. Registrado en RefundJob.`);
        setImmediate(async () => {
          try {
            if (paymentIntentId) {
              await stripe.refunds.create(
                { payment_intent: paymentIntentId },
                { idempotencyKey: `refund-${stripeSessionId}` }
              );
              await prisma.refundJob.update({
                where: { stripeSessionId },
                data: { status: 'COMPLETED' },
              });
              console.log(`Reembolso Stripe exitoso y marcado como COMPLETED para ${stripeSessionId}`);
            }
          } catch (refundErr: any) {
            console.error(`Error al procesar reembolso automático inmediato:`, refundErr.message);
          }
        });
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Error procesando el webhook de Stripe en DB:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    // Para otros tipos de eventos, Stripe espera respuesta rápida 200
    res.status(200).json({ received: true });
  }
};
