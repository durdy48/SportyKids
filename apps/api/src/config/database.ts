import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Waits for the database to become reachable, retrying with fixed delay.
 * Handles Neon cold starts (free tier auto-suspends after inactivity).
 */
export async function waitForDatabase(maxAttempts = 8, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      if (attempt === maxAttempts) throw new Error(`Database unreachable after ${maxAttempts} attempts`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
