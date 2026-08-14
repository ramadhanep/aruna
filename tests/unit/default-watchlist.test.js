import { describe, it, expect } from 'vitest';
import { getDefaultWatchlist, DEFAULT_WATCHLIST } from '@/lib/default-watchlist';

describe('default-watchlist', () => {
  it('returns a fresh copy on each call', () => {
    const first = getDefaultWatchlist();
    const second = getDefaultWatchlist();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first[0].symbol = 'MUTATED';
    expect(getDefaultWatchlist()[0].symbol).toBe('BBCA.JK');
  });

  it('contains IDX, crypto and US tickers with order', () => {
    const list = getDefaultWatchlist();
    const symbols = list.map((item) => item.symbol);
    expect(symbols).toContain('BBRI.JK');
    expect(symbols).toContain('BTC-USD');
    expect(symbols).toContain('NVDA');
    list.forEach((item, index) => {
      expect(item.order).toBe(index + 1);
    });
  });

  it('keeps the constant and the generated list in sync', () => {
    expect(getDefaultWatchlist()).toEqual(DEFAULT_WATCHLIST);
  });
});
