import { describe, it, expect } from 'vitest';
import {
  areWatchlistsEqual,
  matchScreeningEntry,
  computeRSI,
  smoothSeries,
  calculateEMA,
  computeLivermoreKeyLevels,
  isIdxLotSymbol,
  toFiniteNumber,
  normalizeInfoTabParam,
  infoTabToQueryValue,
  getDayOfYear,
  getReturnCellStyle,
  INTRADAY_TIMEFRAMES,
  NORMAL_TIMEFRAME_OPTIONS,
} from '@/lib/chart-helpers';

describe('chart-helpers', () => {
  describe('areWatchlistsEqual', () => {
    it('compares symbols and order', () => {
      expect(areWatchlistsEqual([{ symbol: 'A', order: 1 }], [{ symbol: 'A', order: 1 }])).toBe(true);
      expect(areWatchlistsEqual([{ symbol: 'A', order: 1 }], [{ symbol: 'B', order: 1 }])).toBe(false);
      expect(areWatchlistsEqual([{ symbol: 'A', order: 1 }], [{ symbol: 'A', order: 2 }])).toBe(false);
    });

    it('defaults to equal for empty lists', () => {
      expect(areWatchlistsEqual()).toBe(true);
      expect(areWatchlistsEqual([], [])).toBe(true);
    });
  });

  describe('matchScreeningEntry', () => {
    it('matches string candidates case-insensitively', () => {
      expect(matchScreeningEntry(['BBRI.JK', 'AAPL'], 'bbri.jk')).toEqual({
        symbol: 'BBRI.JK',
        signal_date: null,
        is_warning: false,
        trading_plan: null,
      });
    });

    it('matches object candidates with metadata', () => {
      const results = [{ symbol: 'AAPL', signal_date: '2026-01-01', is_warning: 1, trading_plan: 'buy' }];
      expect(matchScreeningEntry(results, 'aapl')).toEqual({
        symbol: 'AAPL',
        signal_date: '2026-01-01',
        is_warning: true,
        trading_plan: 'buy',
      });
    });

    it('returns null for no match or invalid input', () => {
      expect(matchScreeningEntry([], 'AAPL')).toBeNull();
      expect(matchScreeningEntry(['BBRI.JK'], 'AAPL')).toBeNull();
      expect(matchScreeningEntry(null, 'AAPL')).toBeNull();
    });
  });

  describe('computeRSI', () => {
    const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const falling = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    it('returns nulls when shorter than period', () => {
      expect(computeRSI([1, 2, 3], 14)).toEqual([null, null, null]);
    });

    it('saturates at 100 for a strictly rising series', () => {
      const rsi = computeRSI(rising, 14);
      expect(rsi[14]).toBe(100);
      expect(rsi[15]).toBe(100);
    });

    it('saturates at 0 for a strictly falling series', () => {
      const rsi = computeRSI(falling, 14);
      expect(rsi[14]).toBe(0);
      expect(rsi[15]).toBe(0);
    });
  });

  describe('smoothSeries', () => {
    it('averages within a sliding window', () => {
      expect(smoothSeries([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    });
  });

  describe('calculateEMA', () => {
    it('returns constant for constant input', () => {
      const ema = calculateEMA([5, 5, 5], 13);
      ema.forEach((value) => expect(value).toBeCloseTo(5, 10));
    });

    it('returns empty for empty input', () => {
      expect(calculateEMA([], 13)).toEqual([]);
    });
  });

  describe('computeLivermoreKeyLevels', () => {
    it('tracks rolling high/low per point', () => {
      const points = [
        { time: 1, high: 10, low: 8 },
        { time: 2, high: 12, low: 9 },
      ];
      const result = computeLivermoreKeyLevels(points, 31);
      expect(result.lookup[1]).toEqual({ upper: 10, lower: 8 });
      // Rolling window: min low across all points so far
      expect(result.lookup[2]).toEqual({ upper: 12, lower: 8 });
      expect(result.upper).toEqual([
        { time: 1, value: 10 },
        { time: 2, value: 12 },
      ]);
    });

    it('handles empty input', () => {
      expect(computeLivermoreKeyLevels([], 31)).toEqual({ upper: [], lower: [], lookup: {} });
    });
  });

  describe('symbol helpers', () => {
    it('detects .JK lot symbols', () => {
      expect(isIdxLotSymbol('BBRI.JK')).toBe(true);
      expect(isIdxLotSymbol('AAPL')).toBe(false);
      expect(isIdxLotSymbol('')).toBe(false);
    });

    it('parses finite numbers only', () => {
      expect(toFiniteNumber('12')).toBe(12);
      expect(toFiniteNumber('')).toBeNull();
      expect(toFiniteNumber('abc')).toBeNull();
      expect(toFiniteNumber(null)).toBeNull();
    });
  });

  describe('info tab mapping', () => {
    it('normalizes tab params', () => {
      expect(normalizeInfoTabParam('keystats')).toBe('keystats');
      expect(normalizeInfoTabParam('trading-plan')).toBe('trading-plan');
      expect(normalizeInfoTabParam('about')).toBe('profile');
      expect(normalizeInfoTabParam('nonsense')).toBeNull();
      expect(normalizeInfoTabParam('')).toBeNull();
    });

    it('converts query values to camelCase', () => {
      expect(infoTabToQueryValue('trading-plan')).toBe('tradingPlan');
      expect(infoTabToQueryValue('keystats')).toBe('keystats');
      expect(infoTabToQueryValue('')).toBeNull();
    });
  });

  describe('day of year', () => {
    it('computes day numbers', () => {
      expect(getDayOfYear(new Date(2026, 0, 1))).toBe(1);
      expect(getDayOfYear(new Date(2026, 11, 31))).toBe(365);
    });
  });

  describe('getReturnCellStyle', () => {
    it('colors positive returns green, negative red', () => {
      expect(getReturnCellStyle(5).backgroundColor).toContain('34, 197, 94');
      expect(getReturnCellStyle(-5).backgroundColor).toContain('239, 68, 68');
      expect(getReturnCellStyle(0)).toEqual({});
      expect(getReturnCellStyle(null)).toEqual({});
    });
  });

  describe('timeframe constants', () => {
    it('defines intraday set and normal options', () => {
      expect([...INTRADAY_TIMEFRAMES]).toEqual(['15m', '1h', '2h', '4h']);
      expect(NORMAL_TIMEFRAME_OPTIONS.map((o) => o.value)).toEqual(['15m', '1h', '2h', '4h', 'D', 'W', 'M']);
    });
  });
});
