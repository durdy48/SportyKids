import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import usersRouter from '../routes/users';
import { authMiddleware } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/request-id';
import { errorHandler } from '../middleware/error-handler';
import { generateAccessToken } from '../services/auth-service';

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use(authMiddleware);
app.use('/api/users', usersRouter);
app.use(errorHandler as express.ErrorRequestHandler);

describe('DELETE /api/users/:id/data', () => {
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

  it('returns 404 for non-existent user', async () => {
    const token = generateAccessToken({ userId: 'nonexistent', role: 'child' });

    const res = await request(app)
      .delete('/api/users/nonexistent/data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 without authentication or parental session', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test', age: 10, favoriteSports: ['football'] },
    });
    const res = await request(app).delete(`/api/users/${user.id}/data`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when deleting another user', async () => {
    const targetUser = await prisma.user.create({
      data: { name: 'Target', age: 10, favoriteSports: ['football'] },
    });

    const otherUser = await prisma.user.create({
      data: { name: 'Other', age: 12, favoriteSports: ['basketball'] },
    });

    const token = generateAccessToken({ userId: otherUser.id, role: 'child' });

    const res = await request(app)
      .delete(`/api/users/${targetUser.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('successfully deletes user and all related records', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test Kid', age: 10, favoriteSports: ['football'] },
    });

    // Create related records
    await prisma.activityLog.create({
      data: { userId: user.id, type: 'news_viewed' },
    });
    await prisma.contentReport.create({
      data: { userId: user.id, contentType: 'news', contentId: 'news-1', reason: 'test' },
    });

    const token = generateAccessToken({ userId: user.id, role: 'child' });

    const res = await request(app)
      .delete(`/api/users/${user.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.deletedAt).toBeTruthy();

    // Verify everything was deleted
    const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(deletedUser).toBeNull();

    const logs = await prisma.activityLog.findMany({ where: { userId: user.id } });
    expect(logs).toHaveLength(0);

    const reports = await prisma.contentReport.findMany({ where: { userId: user.id } });
    expect(reports).toHaveLength(0);
  });

  it('returns correct response shape', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test Kid', age: 10, favoriteSports: ['football'] },
    });

    const token = generateAccessToken({ userId: user.id, role: 'child' });

    const res = await request(app)
      .delete(`/api/users/${user.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deleted', true);
    expect(res.body).toHaveProperty('userId', user.id);
    expect(res.body).toHaveProperty('deletedAt');
    // deletedAt should be a valid ISO date string
    expect(new Date(res.body.deletedAt).toISOString()).toBe(res.body.deletedAt);
  });

  it('requires parental session for child accounts with parental profile', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test Kid', age: 10, favoriteSports: ['football'] },
    });

    // Create parental profile
    const hashedPin = await bcrypt.hash('1234', 10);
    await prisma.parentalProfile.create({
      data: { userId: user.id, pin: hashedPin },
    });

    const token = generateAccessToken({ userId: user.id, role: 'child' });

    // Without parental session header
    const res = await request(app)
      .delete(`/api/users/${user.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('allows deletion with valid parental session', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test Kid', age: 10, favoriteSports: ['football'] },
    });

    // Create parental profile
    const hashedPin = await bcrypt.hash('1234', 10);
    await prisma.parentalProfile.create({
      data: { userId: user.id, pin: hashedPin },
    });

    // Create a valid parental session
    const session = await prisma.parentalSession.create({
      data: {
        userId: user.id,
        token: 'valid-session-token',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const token = generateAccessToken({ userId: user.id, role: 'child' });

    const res = await request(app)
      .delete(`/api/users/${user.id}/data`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Parental-Session', session.token);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('nulls out parentUserId on children when deleting a parent', async () => {
    const parent = await prisma.user.create({
      data: { name: 'Parent', age: 35, favoriteSports: ['football'], role: 'parent' },
    });

    const child1 = await prisma.user.create({
      data: { name: 'Child 1', age: 10, favoriteSports: ['football'], parentUserId: parent.id },
    });

    const child2 = await prisma.user.create({
      data: { name: 'Child 2', age: 8, favoriteSports: ['basketball'], parentUserId: parent.id },
    });

    const token = generateAccessToken({ userId: parent.id, role: 'parent' });

    const res = await request(app)
      .delete(`/api/users/${parent.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Parent should be deleted
    const deletedParent = await prisma.user.findUnique({ where: { id: parent.id } });
    expect(deletedParent).toBeNull();

    // Children should still exist but with parentUserId nulled out
    const updatedChild1 = await prisma.user.findUnique({ where: { id: child1.id } });
    expect(updatedChild1).not.toBeNull();
    expect(updatedChild1!.parentUserId).toBeNull();

    const updatedChild2 = await prisma.user.findUnique({ where: { id: child2.id } });
    expect(updatedChild2).not.toBeNull();
    expect(updatedChild2!.parentUserId).toBeNull();
  });

  it('allows parent to delete child account', async () => {
    const parent = await prisma.user.create({
      data: { name: 'Parent', age: 35, favoriteSports: ['football'], role: 'parent' },
    });

    const child = await prisma.user.create({
      data: { name: 'Child', age: 10, favoriteSports: ['football'], parentUserId: parent.id },
    });

    const token = generateAccessToken({ userId: parent.id, role: 'parent' });

    const res = await request(app)
      .delete(`/api/users/${child.id}/data`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.userId).toBe(child.id);
  });
});
