import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createRequestLogger } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: import('pino').Logger;
      userId?: string;  // Set by auth middleware
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;
  req.log = createRequestLogger(requestId);
  res.setHeader('X-Request-ID', requestId);
  next();
}
