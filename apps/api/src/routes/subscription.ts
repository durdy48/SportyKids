import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { requireAuth } from '../middleware/auth';
import { getSubscriptionStatus, processWebhookEvent } from '../services/subscription';
import { AuthenticationError, AuthorizationError } from '../errors';
import { prisma } from '../config/database';
import { logger } from '../services/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/subscription/status/:userId — Current subscription status
// ---------------------------------------------------------------------------

router.get('/status/:userId', requireAuth, async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const authUserId = req.auth!.userId;

  // Ownership check: must be the user themselves OR their parent
  if (authUserId !== userId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { parentUserId: true },
    });
    if (!targetUser || targetUser.parentUserId !== authUserId) {
      throw new AuthorizationError('You can only view your own subscription status');
    }
  }

  const status = await getSubscriptionStatus(userId);
  res.json(status);
});

// ---------------------------------------------------------------------------
// POST /api/subscription/webhook — RevenueCat server-to-server webhook
// ---------------------------------------------------------------------------

const webhookSchema = z.object({
  api_version: z.string(),
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    product_id: z.string().optional(),
    expiration_at_ms: z.number().optional(),
    environment: z.string().optional(),
  }),
});

router.post('/webhook', async (req: Request, res: Response) => {
  // Validate shared secret from Authorization header
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('REVENUECAT_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  const expected = `Bearer ${webhookSecret}`;
  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    throw new AuthenticationError('Invalid webhook secret');
  }

  // Validate request body — return 200 on malformed payloads to prevent RevenueCat retries
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten() }, 'Webhook received invalid payload');
    res.status(200).json({ error: 'invalid_payload' });
    return;
  }

  await processWebhookEvent(parsed.data);

  // Always return 200 to prevent RevenueCat retries
  res.status(200).json({ received: true });
});

export default router;
