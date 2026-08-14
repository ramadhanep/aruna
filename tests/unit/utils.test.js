import { describe, it, expect } from 'vitest';
import {
  cn,
  formatTickerDisplay,
  formatMarketCap,
  formatPrice,
  formatPriceTrim,
  formatPercent,
  formatCompactNumber,
  formatUSD,
  formatIDR,
  formatSGD,
  formatByCurrency,
  getStableColorFromLabel,
  getChangeTone,
} from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges conditional classes', () => {
      expect(cn('a', false && 'b', 'c')).toBe('a c');
    });

    it('resolves tailwind conflicts with twMerge', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });
  });

  describe('formatTickerDisplay', () => {
    it('strips .JK suffix', () => {
      expect(formatTickerDisplay('BBRI.JK')).toBe('BBRI');
    });

    it('leaves non-IDX symbols untouched', () => {
      expect(formatTickerDisplay('AAPL')).toBe('AAPL');
      expect(formatTickerDisplay('BTC-USD')).toBe('BTC-USD');
    });

    it('handles empty input', () => {
      expect(formatTickerDisplay('')).toBe('');
      expect(formatTickerDisplay(null)).toBe('');
    });
  });

  describe('formatMarketCap', () => {
    it('formats trillions, billions, millions', () => {
      expect(formatMarketCap(2_500_000_000_000)).toBe('2.5T');
      expect(formatMarketCap(450_000_000_000)).toBe('450B');
      expect(formatMarketCap(450_600_000_000)).toBe('450.6B');
      expect(formatMarketCap(1_500_000)).toBe('1.5M');
    });

    it('returns fallback for falsy values', () => {
      expect(formatMarketCap(0)).toBe('—');
      expect(formatMarketCap(null)).toBe('—');
    });
  });

  describe('formatPrice', () => {
    it('formats with id-ID grouping', () => {
      expect(formatPrice(1234.567)).toBe('1.235');
    });

    it('respects fraction digits', () => {
      expect(formatPrice(1234.567, { minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false })).toBe('1.234,57');
    });

    it('returns fallback for non-finite values', () => {
      expect(formatPrice(NaN)).toBe('—');
      expect(formatPrice(0)).toBe('—');
    });
  });

  describe('formatPriceTrim', () => {
    it('keeps decimals for US symbols', () => {
      expect(formatPriceTrim(1000, 'AAPL')).toBe('1,000.00');
    });

    it('trims trailing zeros for .JK symbols', () => {
      expect(formatPriceTrim(1000, 'BBRI.JK')).toBe('1,000');
    });

    it('trims trailing zeros for BTC-USD', () => {
      expect(formatPriceTrim(1000, 'BTC-USD')).toBe('1,000');
    });
  });

  describe('formatPercent', () => {
    it('formats one decimal by default', () => {
      expect(formatPercent(12.345)).toBe('12.3%');
    });

    it('adds positive sign when requested', () => {
      expect(formatPercent(5, { showPositiveSign: true })).toBe('+5.0%');
    });

    it('treats null as zero when requested', () => {
      expect(formatPercent(null, { nullAsZero: true })).toBe('0.0%');
    });

    it('returns fallback for non-finite', () => {
      expect(formatPercent('abc')).toBe('—');
    });
  });

  describe('formatCompactNumber', () => {
    it('uses compact notation', () => {
      expect(formatCompactNumber(1500)).toBe('1.5K');
      expect(formatCompactNumber(2_500_000)).toBe('2.5M');
    });

    it('returns fallback for non-finite', () => {
      expect(formatCompactNumber(NaN)).toBe('0');
    });
  });

  describe('currency formatters', () => {
    // Intl currency output (symbol glyph / spacing) varies across ICU builds,
    // so assert on the digits and normalize non-breaking spaces.
    const stripNbsp = (value) => String(value).replace(/\u00a0/g, '');

    it('formats USD', () => {
      expect(formatUSD(1234.5)).toBe('$1,234.50');
    });

    it('formats IDR without fraction digits', () => {
      expect(stripNbsp(formatIDR(1_600_000))).toBe('Rp1.600.000');
    });

    it('formats SGD', () => {
      expect(formatSGD(130)).toContain('130.00');
    });

    it('routes by currency code', () => {
      expect(stripNbsp(formatByCurrency('IDR', 1_600_000))).toBe('Rp1.600.000');
      expect(formatByCurrency('SGD', 130)).toContain('130.00');
      expect(formatByCurrency('USD', 100)).toBe('$100.00');
    });
  });

  describe('getStableColorFromLabel', () => {
    it('is deterministic for the same label', () => {
      expect(getStableColorFromLabel('BBCA')).toBe(getStableColorFromLabel('BBCA'));
    });

    it('returns hsl color pattern', () => {
      expect(getStableColorFromLabel('AAPL')).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
    });

    it('returns fallback for empty label', () => {
      expect(getStableColorFromLabel('')).toBe('hsl(210 70% 56%)');
    });
  });

  describe('getChangeTone', () => {
    it('returns green for non-negative values', () => {
      expect(getChangeTone(1.5)).toBe('text-emerald-600 dark:text-emerald-400');
      expect(getChangeTone(0)).toBe('text-emerald-600 dark:text-emerald-400');
    });

    it('returns red for negative values', () => {
      expect(getChangeTone(-1)).toBe('text-red-500 dark:text-red-400');
    });
  });
});
