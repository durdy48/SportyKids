/**
 * Content moderator for child safety.
 * Uses the AI client to classify news content as safe or unsafe for children.
 *
 * Behaviour on AI failure:
 * - Development / MODERATION_FAIL_OPEN=true  -> content is auto-approved (fail-open)
 * - Production (default)                     -> content stays pending (fail-closed)
 */

import { getAIClient } from './ai-client';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModerationResult {
  status: 'approved' | 'rejected' | 'pending';
  reason?: string;
}

export interface ModerationBatchItem {
  id: string;
  title: string;
  summary: string;
}

export interface ModerationMetrics {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  errors: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Fail-open / fail-closed logic
// ---------------------------------------------------------------------------

/**
 * Returns true if the moderator should fail-open (auto-approve on AI error).
 * Fail-open when:
 *  - NODE_ENV !== 'production'  (dev / test)
 *  - MODERATION_FAIL_OPEN env var is explicitly 'true'
 *
 * Reads process.env on every call intentionally — env vars can change at
 * runtime (e.g. via feature flags or config reloads) and must always
 * reflect the current state.
 */
export function shouldFailOpen(): boolean {
  if (process.env.MODERATION_FAIL_OPEN === 'true') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const MODERATION_SYSTEM_PROMPT = `You are a child safety content moderator for a sports news app aimed at children aged 6-14.

Your job is to classify whether a sports news article is SAFE for children to read.

REJECT content that contains any of the following:
- Gambling, betting, or odds references
- Violence beyond normal sports context (fights, assaults, injuries described graphically)
- Toxic language, insults, or hate speech
- Sexual content or innuendo
- Drug or alcohol references (doping scandals are borderline — reject if graphic detail)
- Politically charged content unrelated to sports
- Content promoting dangerous activities

APPROVE content that is:
- Standard sports news (results, transfers, match previews, player profiles)
- Age-appropriate sports education
- Positive stories about athletes
- Sports statistics and records

Respond with ONLY a JSON object in this exact format, no other text:
{"status": "approved"} or {"status": "rejected", "reason": "brief reason"}`;

// ---------------------------------------------------------------------------
// Core moderation function
// ---------------------------------------------------------------------------

export async function moderateContent(
  title: string,
  summary: string,
): Promise<ModerationResult> {
  try {
    const client = getAIClient();

    const userMessage = `Classify this sports news article:\n\nTitle: ${title}\nSummary: ${summary}`;

    const response = await client.sendMessage(
      [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      'moderation',
    );

    return parseModerationResponse(response.content);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (shouldFailOpen()) {
      logger.warn({ err: errorMsg }, 'AI moderation failed, approving by default (fail-open)');
      return { status: 'approved', reason: 'auto-approved: AI unavailable' };
    }

    logger.warn({ err: errorMsg }, 'AI moderation failed, content stays pending (fail-closed)');
    return { status: 'pending', reason: 'moderation-unavailable' };
  }
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseModerationResponse(raw: string): ModerationResult {
  try {
    // Extract JSON from the response (it may be wrapped in markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ response: raw.substring(0, 200) }, 'Could not find JSON in moderation response');
      return failOpenOrPending('auto: unparseable response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.status === 'rejected') {
      return {
        status: 'rejected',
        reason: parsed.reason || 'No reason provided',
      };
    }

    if (parsed.status === 'approved') {
      return { status: 'approved' };
    }

    // Unknown status
    logger.warn({ status: parsed.status }, 'Unknown status in moderation response');
    return failOpenOrPending('auto: unknown status');
  } catch {
    logger.warn({ response: raw.substring(0, 200) }, 'Failed to parse moderation response');
    return failOpenOrPending('auto: parse error');
  }
}

/**
 * Helper: return approved if fail-open, pending if fail-closed.
 */
function failOpenOrPending(reason: string): ModerationResult {
  if (shouldFailOpen()) {
    return { status: 'approved', reason: `auto-approved: ${reason}` };
  }
  return { status: 'pending', reason };
}

// ---------------------------------------------------------------------------
// Batch moderation
// ---------------------------------------------------------------------------

export async function moderateContentBatch(
  items: ModerationBatchItem[],
): Promise<Map<string, ModerationResult>> {
  const results = new Map<string, ModerationResult>();
  const startTime = Date.now();
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const result = await moderateContent(item.title, item.summary);
      results.set(item.id, result);

      if (result.status === 'approved') approved++;
      else if (result.status === 'rejected') rejected++;
      else pending++;
    } catch {
      errors++;
      const fallback = failOpenOrPending('batch error');
      results.set(item.id, fallback);
      if (fallback.status === 'approved') approved++;
      else pending++;
    }

    // Small delay between items to avoid overwhelming the AI service
    if (items.indexOf(item) < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const durationMs = Date.now() - startTime;
  const metrics: ModerationMetrics = {
    total: items.length,
    approved,
    rejected,
    pending,
    errors,
    durationMs,
  };

  logger.info(
    { total: metrics.total, approved: metrics.approved, rejected: metrics.rejected, pending: metrics.pending, errors: metrics.errors, durationMs: metrics.durationMs },
    'Moderation batch complete',
  );

  return results;
}
