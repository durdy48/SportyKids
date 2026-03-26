/**
 * Formats a Prisma User record for API response.
 * - Parses JSON string fields (favoriteSports, selectedFeeds)
 * - Strips sensitive fields (passwordHash)
 */
export function formatUser(user: Record<string, unknown>) {
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    favoriteSports: typeof rest.favoriteSports === 'string'
      ? JSON.parse(rest.favoriteSports as string)
      : rest.favoriteSports,
    selectedFeeds: typeof rest.selectedFeeds === 'string'
      ? JSON.parse(rest.selectedFeeds as string)
      : rest.selectedFeeds,
  };
}
