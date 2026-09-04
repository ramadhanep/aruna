import { describe, it, expect } from 'vitest';
import {
  isCryptoSymbol,
  toBybitSymbol,
  bybitKlineInterval,
  normalizeKlineRows,
} from '@/lib/bybit';

describe('bybit', () => {
  describe('isCryptoSymbol', () => {
    it('detects Yahoo-style crypto pairs', () => {
      expect(isCryptoSymbol('BTC-USD')).toBe(true);
      expect(isCryptoSymbol('eth-usd')).toBe(true);
      expect(isCryptoSymbol('SOL-USDT')).toBe(true);
    });

    it('detects native Bybit pairs', () => {
      expect(isCryptoSymbol('BTCUSDT')).toBe(true);
      expect(isCryptoSymbol('ethusdt')).toBe(true);
      expect(isCryptoSymbol('1000PEPEUSDT')).toBe(true);
    });

    it('rejects stocks, IDX, and non-crypto input', () => {
      expect(isCryptoSymbol('AAPL')).toBe(false);
      expect(isCryptoSymbol('BBRI.JK')).toBe(false);
      expect(isCryptoSymbol('USDT-EUR')).toBe(false);
      expect(isCryptoSymbol(null)).toBe(false);
      expect(isCryptoSymbol(123)).toBe(false);
    });
  });

  describe('toBybitSymbol', () => {
    it('maps USD and USDT quote currencies to USDT spot pairs', () => {
      expect(toBybitSymbol('BTC-USD')).toBe('BTCUSDT');
      expect(toBybitSymbol('sol-usdt')).toBe('SOLUSDT');
    });

    it('passes native symbols through unchanged', () => {
      expect(toBybitSymbol('BTCUSDT')).toBe('BTCUSDT');
      expect(toBybitSymbol('1000pepeusdt')).toBe('1000PEPEUSDT');
    });
  });

  describe('bybitKlineInterval', () => {
    it('maps supported timeframes and rejects unknown ones', () => {
      expect(bybitKlineInterval('15M')).toBe('15');
      expect(bybitKlineInterval('1H')).toBe('60');
      expect(bybitKlineInterval('D')).toBe('D');
      expect(bybitKlineInterval('W')).toBe('W');
      expect(bybitKlineInterval('M')).toBe('M');
      expect(bybitKlineInterval('ATH')).toBe(null);
    });
  });

  describe('normalizeKlineRows', () => {
    it('reverses newest-first rows into ascending normalized points', () => {
      const rows = [
        ['2000', '11', '14', '10.5', '13', '700'],
        ['1000', '10', '12', '9', '11', '500'],
      ];
      const points = normalizeKlineRows(rows);
      expect(points).toHaveLength(2);
      expect(points[0].timestamp).toBe(1000);
      expect(points[1].timestamp).toBe(2000);
      expect(points[1].close).toBe(13);
      expect(points[1].price).toBe(13);
      expect(points[1].open).toBe(11);
      expect(points[1].high).toBe(14);
      expect(points[1].low).toBe(10.5);
      expect(points[1].volume).toBe(700);
      expect(points[1].date).toBe(new Date(2000).toISOString());
    });

    it('drops rows without a valid timestamp or close', () => {
      const points = normalizeKlineRows([['abc', 'x', 'y', 'z', 'w', 'v'], []]);
      expect(points).toEqual([]);
    });

    it('returns empty for missing list', () => {
      expect(normalizeKlineRows(undefined)).toEqual([]);
    });
  });
});
