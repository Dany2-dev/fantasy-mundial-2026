// Cartera POR LIGA: el presupuesto vive en LeagueMembership.coins, no en User.
// Cada liga es una economía cerrada (€50M al entrar, el dinero no cruza entre
// ligas). Estas funciones centralizan las validaciones — membresía existente y
// saldo suficiente — para que sobres/cláusulas/ventas/intercambios no las
// dupliquen ni las olviden.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Error de negocio esperado (membresía/saldo): las rutas lo convierten en 400.
export class WalletError extends Error {}

export async function getWallet(db: Db, userId: string, leagueId: string) {
  return db.leagueMembership.findUnique({ where: { userId_leagueId: { userId, leagueId } } });
}

export async function requireWallet(db: Db, userId: string, leagueId: string) {
  const wallet = await getWallet(db, userId, leagueId);
  if (!wallet) throw new WalletError("No eres miembro de esta liga");
  return wallet;
}

// Cobra `amount` del presupuesto del usuario EN ESA LIGA. Devuelve el saldo nuevo.
export async function spend(db: Db, userId: string, leagueId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new WalletError("Monto inválido");
  const wallet = await requireWallet(db, userId, leagueId);
  if (wallet.coins < amount) throw new WalletError("No te alcanza el presupuesto en esta liga");
  const updated = await db.leagueMembership.update({
    where: { id: wallet.id },
    data: { coins: { decrement: amount } },
    select: { coins: true },
  });
  return updated.coins;
}

// Abona `amount` al presupuesto del usuario EN ESA LIGA.
export async function deposit(db: Db, userId: string, leagueId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount < 0) throw new WalletError("Monto inválido");
  const wallet = await requireWallet(db, userId, leagueId);
  const updated = await db.leagueMembership.update({
    where: { id: wallet.id },
    data: { coins: { increment: amount } },
    select: { coins: true },
  });
  return updated.coins;
}

// Mueve dinero entre dos mánagers DENTRO de la misma liga (clausulazo, venta,
// intercambio con euros). Valida ambas membresías y el saldo del pagador.
export async function transfer(
  db: Db,
  opts: { leagueId: string; fromUserId: string; toUserId: string; amount: number }
): Promise<void> {
  if (opts.amount === 0) return;
  await spend(db, opts.fromUserId, opts.leagueId, opts.amount);
  await deposit(db, opts.toUserId, opts.leagueId, opts.amount);
}
