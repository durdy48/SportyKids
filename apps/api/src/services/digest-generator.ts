import { prisma } from '../config/database';
import { t, type Locale } from '@sportykids/shared';
import { safeJsonParse } from '../utils/safe-json-parse';

export interface DigestData {
  userName: string;
  period: { from: string; to: string };
  totalMinutes: number;
  dailyAverage: number;
  byType: { news_viewed: number; reels_viewed: number; quizzes_played: number };
  topSports: Array<{ sport: string; count: number }>;
  quizPerformance: { total: number; correctPercent: number; perfectCount: number };
  moderationBlocked: number;
  streak: { current: number; longest: number };
}

export async function generateDigestData(userId: string): Promise<DigestData> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch activity logs from last 7 days
  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: oneWeekAgo },
    },
  });

  // Aggregate by type
  const byType = { news_viewed: 0, reels_viewed: 0, quizzes_played: 0 };
  const sportCounts = new Map<string, number>();
  let totalSeconds = 0;

  for (const log of logs) {
    if (log.type in byType) {
      byType[log.type as keyof typeof byType]++;
    }
    totalSeconds += log.durationSeconds || 0;
    if (log.sport) {
      sportCounts.set(log.sport, (sportCounts.get(log.sport) || 0) + 1);
    }
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  const dailyAverage = Math.round(totalMinutes / 7);

  // Top sports sorted by count descending
  const topSports = Array.from(sportCounts.entries())
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Count rejected news items from last 7 days
  const moderationBlocked = await prisma.newsItem.count({
    where: {
      safetyStatus: 'rejected',
      moderatedAt: { gte: oneWeekAgo },
    },
  });

  // Quiz performance: approximate from total points and quiz count
  const quizTotal = byType.quizzes_played;
  const quizScore = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalPoints: true, quizPerfectCount: true },
  });

  // Rough estimate: each quiz question is worth 10 pts, correct answers get full points
  // This is an approximation since we don't track individual answers in ActivityLog
  const quizPerformance = {
    total: quizTotal,
    correctPercent: quizTotal > 0 ? Math.min(100, Math.round(((quizScore?.totalPoints ?? 0) / Math.max(1, quizTotal * 10)) * 100)) : 0,
    perfectCount: quizScore?.quizPerfectCount ?? 0,
  };

  return {
    userName: user.name,
    period: { from: oneWeekAgo.toISOString(), to: now.toISOString() },
    totalMinutes,
    dailyAverage,
    byType,
    topSports,
    quizPerformance,
    moderationBlocked,
    streak: {
      current: user.currentStreak ?? 0,
      longest: user.longestStreak ?? 0,
    },
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDigestHtml(data: DigestData, locale: Locale): string {
  const fromDate = new Date(data.period.from).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
  const toDate = new Date(data.period.to).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');

  const sportRows = data.topSports
    .map((s) => `<tr><td style="padding:4px 12px;">${escapeHtml(s.sport)}</td><td style="padding:4px 12px;text-align:right;">${s.count}</td></tr>`)
    .join('');

  const title = t('digest.weekly_digest', locale);
  const periodLabel = t('digest.period', locale);
  const totalTimeLabel = t('digest.total_time', locale);
  const dailyAvgLabel = t('digest.daily_average', locale);
  const activityLabel = t('digest.activity', locale);
  const newsLabel = t('parental.news_read', locale);
  const reelsLabel = t('parental.reels_viewed', locale);
  const quizLabel = t('parental.quizzes_played', locale);
  const topSportsLabel = t('digest.top_sports', locale);
  const streakLabel = t('streak.current', locale);
  const longestStreakLabel = t('streak.longest', locale);
  const blockedLabel = t('digest.content_blocked_moderation', locale);
  const quizPerfLabel = t('digest.quiz_performance', locale);
  const minutesUnit = 'min';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#1E293B;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-family:Poppins,sans-serif;color:#2563EB;margin:0;">SportyKids</h1>
      <h2 style="font-family:Poppins,sans-serif;margin:8px 0 0;">${escapeHtml(title)} — ${escapeHtml(data.userName)}</h2>
      <p style="color:#64748B;margin:4px 0;">${periodLabel}: ${fromDate} – ${toDate}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#fff;border-radius:8px;overflow:hidden;">
      <tr style="background:#2563EB;color:#fff;">
        <th style="padding:8px 12px;text-align:left;" colspan="2">${activityLabel}</th>
      </tr>
      <tr><td style="padding:8px 12px;">${totalTimeLabel}</td><td style="padding:8px 12px;text-align:right;font-weight:bold;">${data.totalMinutes} ${minutesUnit}</td></tr>
      <tr style="background:#F1F5F9;"><td style="padding:8px 12px;">${dailyAvgLabel}</td><td style="padding:8px 12px;text-align:right;font-weight:bold;">${data.dailyAverage} ${minutesUnit}</td></tr>
      <tr><td style="padding:8px 12px;">${newsLabel}</td><td style="padding:8px 12px;text-align:right;">${data.byType.news_viewed}</td></tr>
      <tr style="background:#F1F5F9;"><td style="padding:8px 12px;">${reelsLabel}</td><td style="padding:8px 12px;text-align:right;">${data.byType.reels_viewed}</td></tr>
      <tr><td style="padding:8px 12px;">${quizLabel}</td><td style="padding:8px 12px;text-align:right;">${data.byType.quizzes_played}</td></tr>
    </table>

    ${data.topSports.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#fff;border-radius:8px;overflow:hidden;">
      <tr style="background:#22C55E;color:#fff;">
        <th style="padding:8px 12px;text-align:left;" colspan="2">${topSportsLabel}</th>
      </tr>
      ${sportRows}
    </table>` : ''}

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#fff;border-radius:8px;overflow:hidden;">
      <tr style="background:#FACC15;color:#1E293B;">
        <th style="padding:8px 12px;text-align:left;" colspan="2">${quizPerfLabel}</th>
      </tr>
      <tr><td style="padding:8px 12px;">${t('digest.quizzes_played', locale)}</td><td style="padding:8px 12px;text-align:right;">${data.quizPerformance.total}</td></tr>
      <tr style="background:#F1F5F9;"><td style="padding:8px 12px;">${t('digest.correct', locale)}</td><td style="padding:8px 12px;text-align:right;">${data.quizPerformance.correctPercent}%</td></tr>
      <tr><td style="padding:8px 12px;">${t('digest.perfect_quizzes', locale)}</td><td style="padding:8px 12px;text-align:right;">${data.quizPerformance.perfectCount}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#fff;border-radius:8px;overflow:hidden;">
      <tr style="background:#2563EB;color:#fff;">
        <th style="padding:8px 12px;text-align:left;" colspan="2">${streakLabel} / ${longestStreakLabel}</th>
      </tr>
      <tr><td style="padding:8px 12px;">${streakLabel}</td><td style="padding:8px 12px;text-align:right;font-weight:bold;">${data.streak.current} ${t('streak.days', locale)}</td></tr>
      <tr style="background:#F1F5F9;"><td style="padding:8px 12px;">${longestStreakLabel}</td><td style="padding:8px 12px;text-align:right;font-weight:bold;">${data.streak.longest} ${t('streak.days', locale)}</td></tr>
      <tr><td style="padding:8px 12px;">${blockedLabel}</td><td style="padding:8px 12px;text-align:right;">${data.moderationBlocked}</td></tr>
    </table>

    <p style="text-align:center;color:#94A3B8;font-size:12px;margin-top:32px;">
      SportyKids — ${t('digest.safe_news_tagline', locale)}
    </p>
  </div>
</body>
</html>`;
}

export async function renderDigestPdf(data: DigestData, locale: Locale): Promise<Buffer> {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const title = t('digest.weekly_digest', locale);
    const fromDate = new Date(data.period.from).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
    const toDate = new Date(data.period.to).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');

    let y = 20;
    const left = 20;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // blue
    doc.text('SportyKids', left, y);
    y += 10;

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // text color
    doc.text(`${title} — ${data.userName}`, left, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${fromDate} – ${toDate}`, left, y);
    y += 12;

    // Activity summary
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(t('digest.activity', locale), left, y);
    y += 7;

    doc.setFontSize(10);
    const lines = [
      `${t('digest.total_time', locale)}: ${data.totalMinutes} min`,
      `${t('digest.daily_average', locale)}: ${data.dailyAverage} min`,
      `${t('parental.news_read', locale)}: ${data.byType.news_viewed}`,
      `${t('parental.reels_viewed', locale)}: ${data.byType.reels_viewed}`,
      `${t('parental.quizzes_played', locale)}: ${data.byType.quizzes_played}`,
    ];
    for (const line of lines) {
      doc.text(line, left, y);
      y += 6;
    }
    y += 4;

    // Top sports
    if (data.topSports.length > 0) {
      doc.setFontSize(13);
      doc.text(t('digest.top_sports', locale), left, y);
      y += 7;
      doc.setFontSize(10);
      for (const s of data.topSports) {
        doc.text(`${s.sport}: ${s.count}`, left, y);
        y += 6;
      }
      y += 4;
    }

    // Streak
    doc.setFontSize(13);
    doc.text(`${t('streak.current', locale)} / ${t('streak.longest', locale)}`, left, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`${t('streak.current', locale)}: ${data.streak.current} ${t('streak.days', locale)}`, left, y);
    y += 6;
    doc.text(`${t('streak.longest', locale)}: ${data.streak.longest} ${t('streak.days', locale)}`, left, y);
    y += 6;
    doc.text(`${t('digest.content_blocked', locale)}: ${data.moderationBlocked}`, left, y);
    y += 10;

    // Quiz
    doc.setFontSize(13);
    doc.text(t('digest.quiz_performance', locale), left, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`${t('digest.quizzes_played', locale)}: ${data.quizPerformance.total}`, left, y);
    y += 6;
    doc.text(`${t('digest.correct', locale)}: ${data.quizPerformance.correctPercent}%`, left, y);
    y += 6;
    doc.text(`${t('digest.perfect_quizzes', locale)}: ${data.quizPerformance.perfectCount}`, left, y);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SportyKids — ${t('digest.safe_news_tagline', locale)}`,
      left,
      285,
    );

    return Buffer.from(doc.output('arraybuffer'));
  } catch {
    // Fallback: plain text PDF-like buffer if jsPDF fails in Node
    const text = [
      `SportyKids - ${t('digest.weekly_digest', locale)}`,
      `${data.userName}`,
      `${new Date(data.period.from).toLocaleDateString()} - ${new Date(data.period.to).toLocaleDateString()}`,
      '',
      `Total: ${data.totalMinutes} min | Daily avg: ${data.dailyAverage} min`,
      `News: ${data.byType.news_viewed} | Reels: ${data.byType.reels_viewed} | Quiz: ${data.byType.quizzes_played}`,
      `Streak: ${data.streak.current} | Best: ${data.streak.longest}`,
      `Blocked: ${data.moderationBlocked}`,
    ].join('\n');
    return Buffer.from(text, 'utf-8');
  }
}
