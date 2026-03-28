import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const createLimiter = (defaultMax: number, envKey: string) =>
  rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 0 : Number(process.env[envKey] ?? defaultMax), // 0 = disabled in dev
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment.' },
    skip: () => isDev && !process.env[envKey], // Skip unless explicitly configured
  });

export const authLimiter = createLimiter(5, 'RATE_LIMIT_AUTH');
export const pinLimiter = createLimiter(10, 'RATE_LIMIT_PIN');
export const contentLimiter = createLimiter(60, 'RATE_LIMIT_CONTENT');
export const syncLimiter = createLimiter(2, 'RATE_LIMIT_SYNC');
export const defaultLimiter = createLimiter(100, 'RATE_LIMIT_DEFAULT');
