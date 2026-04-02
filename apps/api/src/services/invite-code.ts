import { randomInt } from 'node:crypto';
import { prisma } from '../config/database';

/**
 * Invite code generation for organizations.
 *
 * Codes are 6 characters, uppercase alphanumeric, excluding ambiguous
 * characters (O, 0, I, 1, L) to avoid confusion when shared verbally.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 28 chars
const CODE_LENGTH = 6;
const MAX_RETRIES = 10;

/**
 * Generate a random invite code string.
 */
export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/**
 * Validate that a code matches the expected format.
 */
export function isValidCodeFormat(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const char of code) {
    if (!ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Generate a unique invite code that does not collide with existing organizations.
 * Retries up to MAX_RETRIES times.
 */
export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode();
    const existing = await prisma.organization.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique invite code after maximum retries');
}

/**
 * Generate a URL-friendly slug from an organization name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}

/**
 * Generate a unique slug, appending a numeric suffix on collision.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!base) throw new Error('Name produces empty slug');

  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix++;
    if (suffix > 100) throw new Error('Failed to generate unique slug');
  }
}
