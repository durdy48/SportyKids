/**
 * Formats a Prisma User record for API response.
 * - Strips sensitive fields (passwordHash)
 *
 * Note: favoriteSports and selectedFeeds are native PostgreSQL arrays,
 * no JSON parsing needed.
 */
export function formatUser(user: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, socialId: _socialId, ...rest } = user;
  return rest;
}
