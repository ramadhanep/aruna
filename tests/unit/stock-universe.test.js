import { describe, it, expect } from 'vitest';
import { IDX_SYMBOLS, US_SP500_SYMBOLS, CRYPTO_TOP100_SYMBOLS } from '@/lib/stock-universe';

describe('stock-universe', () => {
  it('exposes IDX symbols as unique non-empty strings', () => {
    expect(Array.isArray(IDX_SYMBOLS)).toBe(true);
    expect(IDX_SYMBOLS.length).toBeGreaterThan(0);
    expect(new Set(IDX_SYMBOLS).size).toBe(IDX_SYMBOLS.length);
    IDX_SYMBOLS.forEach((symbol) => {
      expect(typeof symbol).toBe('string');
      expect(symbol.length).toBeGreaterThan(0);
    });
  });

  it('exposes US S&P 500 symbols as unique strings', () => {
    expect(US_SP500_SYMBOLS.length).toBeGreaterThan(0);
    expect(new Set(US_SP500_SYMBOLS).size).toBe(US_SP500_SYMBOLS.length);
  });

  it('exposes crypto symbols as unique strings', () => {
    expect(CRYPTO_TOP100_SYMBOLS.length).toBeGreaterThan(0);
    expect(new Set(CRYPTO_TOP100_SYMBOLS).size).toBe(CRYPTO_TOP100_SYMBOLS.length);
  });

  it('keeps the three universes disjoint by suffix convention', () => {
    const usSet = new Set(US_SP500_SYMBOLS);
    const cryptoSet = new Set(CRYPTO_TOP100_SYMBOLS);
    const overlap = US_SP500_SYMBOLS.filter((symbol) => cryptoSet.has(symbol));
    expect(overlap).toEqual([]);
    expect(usSet.has('BBRI.JK')).toBe(false);
    expect(cryptoSet.has('AAPL')).toBe(false);
  });
});
