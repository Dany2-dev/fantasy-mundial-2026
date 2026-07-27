import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running custom migrations...');
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD CONSTRAINT "User_coins_non_negative" CHECK (coins >= 0);`
    );
    console.log('Added check constraint User_coins_non_negative successfully.');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('Check constraint User_coins_non_negative already exists.');
    } else {
      console.error('Error adding check constraint:', err.message || err);
    }
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "CoinTransaction_userId_referenceId_type_unique"
       ON "CoinTransaction" ("userId", "referenceId", "type")
       WHERE "referenceId" IS NOT NULL AND "userId" IS NOT NULL;`
    );
    console.log('Created unique index CoinTransaction_userId_referenceId_type_unique successfully.');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('Unique index CoinTransaction_userId_referenceId_type_unique already exists.');
    } else {
      console.error('Error creating unique index:', err.message || err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
