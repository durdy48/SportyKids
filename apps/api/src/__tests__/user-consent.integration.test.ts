import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../config/database';
import usersRouter from '../routes/users';
import { requestIdMiddleware } from '../middleware/request-id';
import { errorHandler } from '../middleware/error-handler';

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use('/api/users', usersRouter);
app.use(errorHandler as express.ErrorRequestHandler);

describe('User Consent Fields', () => {
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

  it('POST /api/users creates user with consent fields defaulting to false', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Test Kid', age: 10, favoriteSports: ['football'] });

    expect(res.status).toBe(201);
    expect(res.body.ageGateCompleted).toBe(false);
    expect(res.body.consentGiven).toBe(false);
    expect(res.body.consentDate).toBeNull();
    expect(res.body.consentBy).toBeNull();
  });

  it('POST /api/users accepts ageGateCompleted and consentGiven', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        name: 'Test Kid',
        age: 10,
        favoriteSports: ['football'],
        ageGateCompleted: true,
        consentGiven: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.ageGateCompleted).toBe(true);
    expect(res.body.consentGiven).toBe(true);
    expect(res.body.consentDate).toBeTruthy();
  });

  it('PUT /api/users/:id updates consent fields', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test Kid', age: 10, favoriteSports: ['football'] });

    const userId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/users/${userId}`)
      .send({ ageGateCompleted: true, consentBy: 'parent-123' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.ageGateCompleted).toBe(true);
    expect(updateRes.body.consentBy).toBe('parent-123');
  });

  it('consentDate auto-set when consentGiven transitions to true', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test Kid', age: 10, favoriteSports: ['football'] });

    const userId = createRes.body.id;

    // Verify initially no consent date
    expect(createRes.body.consentGiven).toBe(false);
    expect(createRes.body.consentDate).toBeNull();

    const before = new Date();

    const updateRes = await request(app)
      .put(`/api/users/${userId}`)
      .send({ consentGiven: true });

    const after = new Date();

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.consentGiven).toBe(true);
    expect(updateRes.body.consentDate).toBeTruthy();

    const consentDate = new Date(updateRes.body.consentDate);
    expect(consentDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(consentDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('consentDate not re-set when consentGiven is already true', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Test Kid',
        age: 10,
        favoriteSports: ['football'],
        consentGiven: true,
      });

    const userId = createRes.body.id;
    const originalConsentDate = createRes.body.consentDate;

    // Update with consentGiven still true
    const updateRes = await request(app)
      .put(`/api/users/${userId}`)
      .send({ consentGiven: true, consentBy: 'parent-abc' });

    expect(updateRes.status).toBe(200);
    // consentDate should remain the same
    expect(updateRes.body.consentDate).toBe(originalConsentDate);
  });

  it('GET /api/users/:id returns consent fields', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Test Kid',
        age: 10,
        favoriteSports: ['football'],
        ageGateCompleted: true,
        consentGiven: true,
      });

    const userId = createRes.body.id;

    const getRes = await request(app).get(`/api/users/${userId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.ageGateCompleted).toBe(true);
    expect(getRes.body.consentGiven).toBe(true);
    expect(getRes.body.consentDate).toBeTruthy();
    expect(getRes.body).toHaveProperty('consentBy');
  });
});
