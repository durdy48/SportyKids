import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../services/auth-service';

// Extend Express Request to carry auth info
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

/**
 * Non-blocking auth middleware.
 * Checks for Bearer token and attaches req.auth if valid.
 * Always calls next() — anonymous requests pass through.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.auth = payload;
    }
  }
  next();
}

/**
 * Blocking middleware — requires a valid JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Factory: requires a specific role.
 */
export function requireRole(role: 'child' | 'parent') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.auth.role !== role) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
