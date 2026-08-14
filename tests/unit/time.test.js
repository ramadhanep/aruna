import { describe, it, expect } from 'vitest';
import { getRecentUnixRange, RECENT_PRICE_LOOKBACK_DAYS, MOBILE_BREAKPOINT } from '@/lib/time';

describe('time', () => {
  it('exposes mobile breakpoint and lookback constant', () => {
    expect(MOBILE_BREAKPOINT).toBe(1024);
    expect(RECENT_PRICE_LOOKBACK_DAYS).toBe(5);
  });

  it('computes a unix second range', () => {
    const nowMs = 1_752_000_000_000;
    const range = getRecentUnixRange(5, nowMs);
    expect(range.endDate).toBe(1_752_000_000);
    expect(range.startDate).toBe(1_752_000_000 - 5 * 86_400);
  });

  it('defaults to 5 days', () => {
    const nowMs = 1_752_000_000_000;
    const range = getRecentUnixRange(undefined, nowMs);
    expect(range.startDate).toBe(range.endDate - 5 * 86_400);
  });
});
