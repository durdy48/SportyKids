import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from './index';

describe('Typed Error Classes', () => {
  const errorClasses = [
    { Class: ValidationError, statusCode: 400, code: 'VALIDATION_ERROR', name: 'ValidationError' },
    { Class: AuthenticationError, statusCode: 401, code: 'AUTHENTICATION_ERROR', name: 'AuthenticationError' },
    { Class: AuthorizationError, statusCode: 403, code: 'AUTHORIZATION_ERROR', name: 'AuthorizationError' },
    { Class: NotFoundError, statusCode: 404, code: 'NOT_FOUND', name: 'NotFoundError' },
    { Class: ConflictError, statusCode: 409, code: 'CONFLICT', name: 'ConflictError' },
    { Class: RateLimitError, statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', name: 'RateLimitError' },
  ] as const;

  for (const { Class, statusCode, code, name } of errorClasses) {
    describe(name, () => {
      it(`has statusCode ${statusCode}`, () => {
        const err = new Class('test message');
        expect(err.statusCode).toBe(statusCode);
      });

      it(`has code "${code}"`, () => {
        const err = new Class('test message');
        expect(err.code).toBe(code);
      });

      it(`has name "${name}"`, () => {
        const err = new Class('test message');
        expect(err.name).toBe(name);
      });

      it('is instanceof AppError', () => {
        const err = new Class('test message');
        expect(err).toBeInstanceOf(AppError);
      });

      it('is instanceof Error', () => {
        const err = new Class('test message');
        expect(err).toBeInstanceOf(Error);
      });

      it('carries message', () => {
        const err = new Class('specific error message');
        expect(err.message).toBe('specific error message');
      });

      it('carries optional details', () => {
        const details = { field: 'email', reason: 'invalid' };
        const err = new Class('test', details);
        expect(err.details).toEqual(details);
      });

      it('has undefined details when not provided', () => {
        const err = new Class('test');
        expect(err.details).toBeUndefined();
      });

      it('has a stack trace', () => {
        const err = new Class('test');
        expect(err.stack).toBeDefined();
        expect(err.stack).toContain(name);
      });
    });
  }
});
