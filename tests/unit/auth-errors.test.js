import { describe, it, expect } from 'vitest';
import { getAuthErrorKey } from '@/lib/auth-errors';

describe('auth-errors', () => {
  it('maps invalid login credentials', () => {
    expect(getAuthErrorKey({ message: 'Invalid login credentials' })).toBe('invalidCredentials');
  });

  it('maps email not confirmed', () => {
    expect(getAuthErrorKey({ message: 'Email not confirmed' })).toBe('emailNotConfirmed');
  });

  it('maps user already registered', () => {
    expect(getAuthErrorKey({ message: 'User already registered' })).toBe('userExists');
  });

  it('maps weak password suggestion', () => {
    expect(getAuthErrorKey({ message: 'Password should be at least 6 characters' })).toBe('weakPassword');
  });

  it('maps new password equal to old password', () => {
    expect(getAuthErrorKey({ message: 'The new password should be different from the old password.' })).toBe('samePassword');
  });

  it('maps too many requests', () => {
    expect(getAuthErrorKey({ message: 'Too many requests' })).toBe('tooManyRequests');
  });

  it('falls back to generic for unknown messages', () => {
    expect(getAuthErrorKey({ message: 'something odd happened' })).toBe('generic');
  });

  it('returns null when no error', () => {
    expect(getAuthErrorKey(null)).toBeNull();
    expect(getAuthErrorKey(undefined)).toBeNull();
  });

  it('matches unknown fuzzy messages by keyword', () => {
    expect(getAuthErrorKey({ message: 'Login credentials are invalid' })).toBe('invalidCredentials');
    expect(getAuthErrorKey({ message: 'Email address not confirmed' })).toBe('emailNotConfirmed');
  });
});