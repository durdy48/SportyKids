import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticationError, AuthorizationError } from '../errors';

/**
 * Middleware that requires the authenticated user to be an org admin of the
 * organization identified by `req.params.id`.
 *
 * Must be placed after `requireAuth` in the middleware chain.
 */
export async function requireOrgAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.auth) {
    throw new AuthenticationError('Authentication required');
  }

  const orgId = req.params.id;
  if (!orgId) {
    throw new AuthorizationError('Organization ID required');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { organizationId: true, organizationRole: true },
  });

  if (!user || user.organizationId !== orgId || user.organizationRole !== 'admin') {
    throw new AuthorizationError('Insufficient permissions');
  }

  next();
}
