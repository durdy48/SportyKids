import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../config/database';
import { shouldTrackUser } from '../services/monitoring';

describe('Analytics Consent — shouldTrackUser', () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.contentReport.deleteMany();
    await prisma.userSticker.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.pushToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.dailyMission.deleteMany();
    await prisma.parentalSession.deleteMany();
    await prisma.parentalProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  it('returns false for users with consentGiven=false', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'No Consent Kid',
        age: 10,
        favoriteSports: ['football'],
        consentGiven: false,
      },
    });

    const result = await shouldTrackUser(user.id);
    expect(result).toBe(false);
  });

  it('returns true for users with consentGiven=true', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Consent Kid',
        age: 10,
        favoriteSports: ['football'],
        consentGiven: true,
        consentDate: new Date(),
      },
    });

    const result = await shouldTrackUser(user.id);
    expect(result).toBe(true);
  });

  it('returns false for non-existent user', async () => {
    const result = await shouldTrackUser('nonexistent-id');
    expect(result).toBe(false);
  });
});
