import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import Stripe from "stripe";

const router = Router();
router.use(requireAuth);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const isStripeConfigured = !!stripeSecretKey && stripeSecretKey !== 'dummy_key' && !stripeSecretKey.startsWith('dummy');

const stripe = new Stripe(stripeSecretKey || 'dummy_key', {
  apiVersion: '2023-10-16' as any,
});

const COIN_PACKAGES: Record<string, { priceCents: number; coins: number; name: string }> = {
  'coins-pack-small': { priceCents: 499, coins: 5000, name: 'Bolsa de 5,000 Monedas' },
  'coins-pack-medium': { priceCents: 999, coins: 11000, name: 'Cofre de 11,000 Monedas (+10% Bonus)' },
  'coins-pack-large': { priceCents: 1999, coins: 25000, name: 'Caja Fuerte de 25,000 Monedas (+25% Bonus)' },
};

router.post("/buy-coins", async (req, res) => {
  const { packageId } = req.body;
  const userId = (req as AuthRequest).userId;

  const selectedPackage = COIN_PACKAGES[packageId];
  if (!selectedPackage) {
    return res.status(400).json({ error: "Paquete de monedas inválido" });
  }

  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  const frontendUrl = process.env.FRONTEND_URL || origin || 'http://localhost:8080';

  // Si Stripe no está configurado con clave real, ejecutar checkout simulado localmente
  if (!isStripeConfigured) {
    console.warn("⚠️ STRIPE_SECRET_KEY no configurada. Ejecutando compra simulada localmente.");
    try {
      const mockSessionId = `mock_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await prisma.$transaction(async (tx) => {
        // Asegurar que la cuenta del sistema SYSTEM_EMISSION exista
        await tx.systemAccount.upsert({
          where: { id: 'SYSTEM_EMISSION' },
          update: {},
          create: { id: 'SYSTEM_EMISSION', balance: 0 },
        });

        // 1. Crear orden de pago en estado COMPLETED
        const paymentOrder = await tx.paymentOrder.create({
          data: {
            userId,
            stripeSessionId: mockSessionId,
            amountPaidCents: selectedPackage.priceCents,
            coinsAmount: selectedPackage.coins,
            status: 'COMPLETED',
          },
        });

        // 2. Registros contables en CoinTransaction
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: selectedPackage.coins,
            type: 'BUY',
            referenceId: paymentOrder.id,
            status: 'COMPLETED',
            description: `Compra Demo - ${selectedPackage.coins.toLocaleString()} Coins`,
          },
        });

        await tx.coinTransaction.create({
          data: {
            systemAccountId: 'SYSTEM_EMISSION',
            amount: -selectedPackage.coins,
            type: 'BUY',
            referenceId: paymentOrder.id,
            status: 'COMPLETED',
            description: `Emisión Demo de Coins para usuario ${userId}`,
          },
        });

        // 3. Incrementar monedas del usuario y decrementar emisión
        await tx.user.update({
          where: { id: userId },
          data: { coins: { increment: selectedPackage.coins } },
        });

        await tx.systemAccount.update({
          where: { id: 'SYSTEM_EMISSION' },
          data: { balance: { decrement: selectedPackage.coins } },
        });
      });

      return res.json({ url: `${frontendUrl}/shop?payment=success` });
    } catch (error: any) {
      console.error("Error al procesar compra simulada:", error.message);
      return res.status(500).json({ error: `Error al procesar la compra: ${error.message}` });
    }
  }

  // Si Stripe SÍ está configurado con clave secreta real (sk_test_...)
  try {
    // 1. Crear la sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPackage.name,
              description: `Monedas virtuales para canjear en la tienda de Fantasy Mundial 2026`,
            },
            unit_amount: selectedPackage.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/shop?payment=success`,
      cancel_url: `${frontendUrl}/shop?payment=cancel`,
      metadata: {
        userId,
        packageId,
        coinsAmount: selectedPackage.coins.toString(),
      },
    });

    // 2. Registrar la orden en estado PENDING
    await prisma.paymentOrder.create({
      data: {
        userId,
        stripeSessionId: session.id,
        amountPaidCents: selectedPackage.priceCents,
        coinsAmount: selectedPackage.coins,
        status: 'PENDING',
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error al iniciar el checkout de Stripe:', error.message);
    res.status(500).json({ error: `Error al procesar el checkout con Stripe: ${error.message}` });
  }
});

router.get("/transactions", async (req, res) => {
  const userId = (req as AuthRequest).userId;
  try {
    const transactions = await prisma.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ transactions });
  } catch (error: any) {
    console.error("Error al obtener transacciones contables:", error.message);
    res.status(500).json({ error: "Error al obtener transacciones" });
  }
});

export default router;
