/**
 * Content moderator for child safety.
 * Uses the AI client to classify news content as safe or unsafe for children.
 * Fails open — if AI is unavailable, content is approved by default.
 */

import { getAIClient, AIServiceError } from './ai-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModerationResult {
  status: 'approved' | 'rejected';
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
  errors: number;
  durationMs: number;
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
    // Fail open — if AI is unavailable, approve the content
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Moderator] AI moderation failed, approving by default: ${errorMsg}`);
    return { status: 'approved', reason: 'auto-approved: AI unavailable' };
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
      console.warn(`[Moderator] Could not find JSON in response: ${raw.substring(0, 200)}`);
      return { status: 'approved', reason: 'auto-approved: unparseable response' };
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

    // Unknown status — fail open
    console.warn(`[Moderator] Unknown status in response: ${parsed.status}`);
    return { status: 'approved', reason: 'auto-approved: unknown status' };
  } catch {
    console.warn(`[Moderator] Failed to parse moderation response: ${raw.substring(0, 200)}`);
    return { status: 'approved', reason: 'auto-approved: parse error' };
  }
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
  let errors = 0;

  for (const item of items) {
    try {
      const result = await moderateContent(item.title, item.summary);
      results.set(item.id, result);

      if (result.status === 'approved') approved++;
      else rejected++;
    } catch {
      errors++;
      // Fail open on unexpected errors
      results.set(item.id, { status: 'approved', reason: 'auto-approved: batch error' });
      approved++;
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
    errors,
    durationMs,
  };

  console.log(
    `[Moderator] Batch complete: ${metrics.total} items, ` +
    `${metrics.approved} approved, ${metrics.rejected} rejected, ` +
    `${metrics.errors} errors, ${metrics.durationMs}ms`,
  );

  return results;
}
