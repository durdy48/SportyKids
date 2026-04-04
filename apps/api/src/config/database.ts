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

/**
 * Starts a keep-alive ping every 4 minutes to prevent Neon from suspending
 * the database during active periods. Neon free tier suspends after 5 min
 * of inactivity — this keeps the connection warm without hammering the DB.
 */
export function startDatabaseKeepAlive(): void {
  const INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // DB went to sleep mid-session — reconnect silently
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch {
        // Will recover on next real request
      }
    }
  }, INTERVAL_MS);
}
