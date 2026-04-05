/* eslint-disable no-console */
/**
 * Script to create or promote a user to admin role.
 *
 * Usage:
 *   npx tsx apps/api/scripts/create-admin.ts <email>
 *
 * - If the user exists: updates their role to 'admin'
 * - If the user does not exist: creates a new user with authProvider='email', role='admin',
 *   and a random temporary password (printed to stdout)
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database';

const SALT_ROUNDS = 10;

function generateTempPassword(): string {
  // Use cryptographically secure random bytes for admin temp passwords
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx apps/api/scripts/create-admin.ts <email>');
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Invalid email: ${email}`);
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { role: 'admin' },
      });
      console.log(`✓ User ${email} (id: ${existing.id}) updated to role='admin'`);
    } else {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          authProvider: 'email',
          role: 'admin',
          name: email.split('@')[0],
          age: 18, // Admin users are adults; minimum valid age for non-child accounts
        },
      });

      console.log(`✓ Admin user created`);
      console.log(`  Email:    ${email}`);
      console.log(`  ID:       ${user.id}`);
      console.log(`  Password: ${tempPassword}`);
      console.log('  (Change this password after first login)');
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
