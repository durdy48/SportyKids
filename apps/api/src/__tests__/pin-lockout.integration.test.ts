import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import parentsRouter from '../routes/parents';
import { requestIdMiddleware } from '../middleware/request-id';
import { errorHandler } from '../middleware/error-handler';

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use('/api/parents', parentsRouter);
app.use(errorHandler as express.ErrorRequestHandler);

const TEST_PIN = '1234';
const WRONG_PIN = '9999';

async function createTestUserWithProfile(pin: string = TEST_PIN) {
  const user = await prisma.user.create({
    data: { name: 'Test Kid', age: 10, favoriteSports: ['football'] },
  });
  const hashedPin = await bcrypt.hash(pin, 10);
  await prisma.parentalProfile.create({
    data: { userId: user.id, pin: hashedPin },
  });
  return user;
}

describe('PIN Lockout', () => {
  beforeEach(async () => {
    // Delete in FK-safe order
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

  it('returns 200 and resets counter on correct PIN', async () => {
    const user = await createTestUserWithProfile();

    // First add some failed attempts
    await prisma.parentalProfile.update({
      where: { userId: user.id },
      data: { failedAttempts: 3 },
    });

    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: TEST_PIN });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    // Verify counter was reset
    const profile = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    expect(profile!.failedAttempts).toBe(0);
    expect(profile!.lockedUntil).toBeNull();
  });

  it('returns 401 with attemptsRemaining on wrong PIN', async () => {
    const user = await createTestUserWithProfile();

    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: WRONG_PIN });

    expect(res.status).toBe(401);
    expect(res.body.attemptsRemaining).toBe(4);
    expect(res.body.error).toBeTruthy();

    const profile = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    expect(profile!.failedAttempts).toBe(1);
  });

  it('locks after 5 failed attempts', async () => {
    const user = await createTestUserWithProfile();

    // Submit 4 wrong PINs
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/parents/verify-pin')
        .send({ userId: user.id, pin: WRONG_PIN });
      expect(res.status).toBe(401);
      expect(res.body.attemptsRemaining).toBe(4 - i);
    }

    // 5th wrong PIN should lock
    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: WRONG_PIN });

    expect(res.status).toBe(423);
    expect(res.body.lockedUntil).toBeTruthy();
    expect(res.body.remainingSeconds).toBeGreaterThan(0);
    expect(res.body.remainingSeconds).toBeLessThanOrEqual(900);
  });

  it('returns 423 during lockout without bcrypt compare', async () => {
    const user = await createTestUserWithProfile();

    // Set lockout in the future
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.parentalProfile.update({
      where: { userId: user.id },
      data: { failedAttempts: 5, lockedUntil },
    });

    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: TEST_PIN }); // correct PIN should still be rejected

    expect(res.status).toBe(423);
    expect(res.body.remainingSeconds).toBeGreaterThan(0);
  });

  it('unlocks after lockout expires', async () => {
    const user = await createTestUserWithProfile();

    // Set lockout in the past
    const lockedUntil = new Date(Date.now() - 1000);
    await prisma.parentalProfile.update({
      where: { userId: user.id },
      data: { failedAttempts: 5, lockedUntil },
    });

    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: TEST_PIN });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const profile = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    expect(profile!.failedAttempts).toBe(0);
    expect(profile!.lockedUntil).toBeNull();
  });

  it('resets counter on correct PIN after partial failures', async () => {
    const user = await createTestUserWithProfile();

    // Submit 3 wrong PINs
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/parents/verify-pin')
        .send({ userId: user.id, pin: WRONG_PIN });
    }

    const profile1 = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    expect(profile1!.failedAttempts).toBe(3);

    // Correct PIN resets
    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: TEST_PIN });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const profile2 = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    expect(profile2!.failedAttempts).toBe(0);
  });

  it('lockout duration is 15 minutes', async () => {
    const user = await createTestUserWithProfile();

    // Set 4 failed attempts
    await prisma.parentalProfile.update({
      where: { userId: user.id },
      data: { failedAttempts: 4 },
    });

    const before = Date.now();
    const res = await request(app)
      .post('/api/parents/verify-pin')
      .send({ userId: user.id, pin: WRONG_PIN });
    const after = Date.now();

    expect(res.status).toBe(423);

    const profile = await prisma.parentalProfile.findUnique({ where: { userId: user.id } });
    const lockedUntilMs = new Date(profile!.lockedUntil!).getTime();
    const fifteenMinMs = 15 * 60 * 1000;

    // lockedUntil should be approximately now + 15 minutes (within 2 seconds tolerance)
    expect(lockedUntilMs).toBeGreaterThanOrEqual(before + fifteenMinMs - 2000);
    expect(lockedUntilMs).toBeLessThanOrEqual(after + fifteenMinMs + 2000);
  });
});
