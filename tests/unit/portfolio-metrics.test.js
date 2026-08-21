import { describe, it, expect } from 'vitest';
import {
  isIDRSymbol,
  isLotUnit,
  getEffectiveAmount,
  toUSD,
  usdToIdr,
  usdToSgd,
  formatValue,
  computeHoldingsMetrics,
  sortHoldings,
  computePortfolioSummary,
  computeDigitalAllocation,
  computeCashTypeAllocation,
} from '@/lib/portfolio-metrics';

const FX_RATE = 1 / 16000;

describe('portfolio-metrics', () => {
  describe('currency helpers', () => {
    it('detects IDX symbols by .JK suffix', () => {
      expect(isIDRSymbol('BBRI.JK')).toBe(true);
      expect(isIDRSymbol('AAPL')).toBe(false);
    });

    it('treats lot as 100 shares', () => {
      expect(isLotUnit('lot')).toBe(true);
      expect(getEffectiveAmount(2, 'lot')).toBe(200);
      expect(getEffectiveAmount(10, 'unit')).toBe(10);
    });

    it('converts IDR price to USD via fxRate', () => {
      expect(toUSD('BBRI.JK', 5000, FX_RATE)).toBeCloseTo(0.3125, 6);
      expect(toUSD('AAPL', 100, FX_RATE)).toBe(100);
    });

    it('returns raw price when fxRate is unavailable', () => {
      expect(toUSD('BBRI.JK', 5000, 0)).toBe(5000);
    });

    it('converts USD to IDR and SGD', () => {
      expect(usdToIdr(100, 16000)).toBe(1_600_000);
      expect(usdToSgd(100, 1.3)).toBe(130);
      expect(usdToIdr(100, 0)).toBe(0);
      expect(usdToSgd(100, 0)).toBe(0);
    });
  });

  describe('formatValue', () => {
    const stripNbsp = (value) => String(value).replace(/\u00a0/g, '');

    it('formats USD primary with IDR/SGD secondary', () => {
      const result = formatValue(100, 'USD', 16000, 1.3);
      expect(result.primary).toBe('$100.00');
      expect(stripNbsp(result.secondary)).toBe('Rp1.600.000');
      expect(result.tertiary).toContain('130.00');
    });

    it('falls back to unavailable FX labels', () => {
      const result = formatValue(100, 'IDR', 0, 1.3);
      expect(result.primary).toBe('$100.00');
      expect(result.secondary).toBe('IDR FX unavailable');
    });
  });

  describe('computeHoldingsMetrics', () => {
    it('computes base/current value and pnl for lot-based IDX holding', () => {
      const entries = [{ type: 'stock', symbol: 'BBRI.JK', amount: 2, unit: 'lot', avgPrice: 5000 }];
      const metrics = computeHoldingsMetrics(entries, { 'BBRI.JK': 5500 }, FX_RATE, 1.3);
      expect(metrics[0].effectiveAmount).toBe(200);
      expect(metrics[0].baseValueUSD).toBeCloseTo(62.5, 6);
      expect(metrics[0].currentValueUSD).toBeCloseTo(68.75, 6);
      expect(metrics[0].pnl).toBeCloseTo(6.25, 6);
      expect(metrics[0].isCash).toBe(false);
    });

    it('treats cash entries as-is', () => {
      const entries = [{ type: 'cash', amount: 1000, avgPrice: 1, cashCurrency: 'USD' }];
      const metrics = computeHoldingsMetrics(entries, {}, FX_RATE, 1.3);
      expect(metrics[0].isCash).toBe(true);
      expect(metrics[0].effectiveAmount).toBe(1);
      expect(metrics[0].baseValueUSD).toBe(1000);
      expect(metrics[0].currentValueUSD).toBe(1000);
      expect(metrics[0].pnl).toBe(0);
      expect(metrics[0].cashDisplayAmount).toBe(1000);
    });

    it('falls back to avgPrice when no live price', () => {
      const entries = [{ type: 'stock', symbol: 'AAPL', amount: 10, unit: 'unit', avgPrice: 150 }];
      const metrics = computeHoldingsMetrics(entries, {}, FX_RATE, 1.3);
      expect(metrics[0].currentValueUSD).toBe(1500);
      expect(metrics[0].pnl).toBe(0);
    });

    it('prices digital entries flagged as cash like normal holdings', () => {
      const entries = [{ type: 'digital', symbol: 'USDT-USD', amount: 1000, unit: 'share', avgPrice: 1, isCash: true }];
      const metrics = computeHoldingsMetrics(entries, { 'USDT-USD': 1 }, FX_RATE, 1.3);
      expect(metrics[0].isCash).toBe(false);
      expect(metrics[0].currentValueUSD).toBe(1000);
    });
  });

  describe('sortHoldings', () => {
    const makeMetric = (symbol, value) => ({
      isCash: false,
      entry: { symbol },
      currentValueUSD: value,
      pnl: value * 0.1,
    });

    it('sorts digital holdings by market value desc, cash last', () => {
      const holdings = [makeMetric('AAPL', 500), makeMetric('BBRI.JK', 100), { isCash: true, entry: { category: 'Cash' }, currentValueUSD: 999 }];
      const sorted = sortHoldings(holdings, 'market');
      expect(sorted[0].entry.symbol).toBe('AAPL');
      expect(sorted[1].entry.symbol).toBe('BBRI.JK');
      expect(sorted[2].isCash).toBe(true);
    });

    it('sorts alphabetically as default', () => {
      const holdings = [makeMetric('NVDA', 1), makeMetric('AAPL', 999)];
      const sorted = sortHoldings(holdings, 'symbol');
      expect(sorted[0].entry.symbol).toBe('AAPL');
    });
  });

  describe('computePortfolioSummary', () => {
    it('sums digital cost, market value and cash', () => {
      const entries = [
        { type: 'stock', symbol: 'AAPL', amount: 10, unit: 'unit', avgPrice: 100 },
        { type: 'stock', symbol: 'BBRI.JK', amount: 1, unit: 'lot', avgPrice: 5000 },
        { type: 'cash', amount: 500, avgPrice: 1 },
      ];
      const priceMap = { AAPL: 120, 'BBRI.JK': 5500 };
      const summary = computePortfolioSummary(entries, priceMap, FX_RATE);
      // AAPL: cost 1000, market 1200; BBRI: cost 5000*FX*100, market 5500*FX*100
      expect(summary.digitalCost).toBeCloseTo(1000 + 5000 * FX_RATE * 100, 6);
      expect(summary.digitalMarket).toBeCloseTo(1200 + 5500 * FX_RATE * 100, 6);
      expect(summary.digitalPnL).toBeCloseTo(summary.digitalMarket - summary.digitalCost, 6);
      expect(summary.totalCash).toBe(500);
      expect(summary.totalNetWorth).toBeCloseTo(summary.digitalMarket + 500, 6);
    });

    it('counts digital entries flagged as cash toward totalCash at market value', () => {
      const entries = [
        { type: 'stock', symbol: 'AAPL', amount: 10, unit: 'unit', avgPrice: 100 },
        { type: 'digital', symbol: 'USDT-USD', amount: 1000, unit: 'share', avgPrice: 1, isCash: true },
        { type: 'cash', amount: 500, avgPrice: 1 },
      ];
      const summary = computePortfolioSummary(entries, { AAPL: 120, 'USDT-USD': 1 }, FX_RATE);
      expect(summary.digitalMarket).toBeCloseTo(1200, 6);
      expect(summary.totalCash).toBeCloseTo(1500, 6);
      expect(summary.totalNetWorth).toBeCloseTo(2700, 6);
    });
  });

  describe('computeDigitalAllocation', () => {
    it('maps holdings to display names and logos', () => {
      const holdings = [
        {
          isCash: false,
          entry: { symbol: 'BBRI.JK' },
          currentValueUSD: 100,
        },
      ];
      const allocation = computeDigitalAllocation(holdings, { 'BBRI.JK': 'https://logo' });
      expect(allocation).toEqual([
        { name: 'BBRI', symbol: 'BBRI.JK', logo: 'https://logo', value: 100 },
      ]);
    });

    it('excludes cash entries', () => {
      const holdings = [{ isCash: true, entry: { type: 'cash', symbol: 'Cash' }, currentValueUSD: 100 }];
      expect(computeDigitalAllocation(holdings, {})).toEqual([]);
    });

    it('excludes digital entries flagged as cash', () => {
      const holdings = [{ isCash: false, entry: { type: 'digital', symbol: 'USDT-USD', isCash: true }, currentValueUSD: 1000 }];
      expect(computeDigitalAllocation(holdings, {})).toEqual([]);
    });
  });

  describe('computeCashTypeAllocation', () => {
    it('groups cash by currency', () => {
      const holdings = [
        { isCash: true, entry: { type: 'cash', cashCurrency: 'IDR' }, currentValueUSD: 40 },
        { isCash: true, entry: { type: 'cash', cashCurrency: 'IDR' }, currentValueUSD: 35 },
        { isCash: true, entry: { type: 'cash', cashCurrency: 'USD' }, currentValueUSD: 25 },
      ];
      const result = computeCashTypeAllocation(holdings);
      expect(result).toEqual([
        { name: 'IDR', value: 75 },
        { name: 'USD', value: 25 },
      ]);
    });

    it('groups digital entries flagged as cash by symbol', () => {
      const holdings = [
        { isCash: false, entry: { type: 'digital', symbol: 'USDT-USD', isCash: true }, currentValueUSD: 1000 },
        { isCash: true, entry: { type: 'cash', cashCurrency: 'USD' }, currentValueUSD: 500 },
      ];
      expect(computeCashTypeAllocation(holdings)).toEqual([
        { name: 'USDT-USD', value: 1000 },
        { name: 'USD', value: 500 },
      ]);
    });
  });
});
