import { describe, it, expect } from 'vitest';
import {
  MSCI_THRESHOLDS,
  calculateFreeFloatMcap,
  getMSCIThresholdIDR,
  calculateProgress,
  calculateTargetPrice,
  calculateUpside,
  getStatusBadge,
  calculateMSCIMetrics,
  calculateSummaryStats,
} from '@/lib/msci-calculations';

const USD_TO_IDR = 15800;

describe('msci-calculations', () => {
  describe('thresholds', () => {
    it('exposes standard and small-cap thresholds', () => {
      expect(MSCI_THRESHOLDS.standard).toBe(2_000_000_000);
      expect(MSCI_THRESHOLDS.small_cap).toBe(300_000_000);
    });

    it('converts thresholds to IDR', () => {
      expect(getMSCIThresholdIDR('standard')).toBe(2_000_000_000 * USD_TO_IDR);
      expect(getMSCIThresholdIDR('small_cap')).toBe(300_000_000 * USD_TO_IDR);
    });

    it('falls back to standard for unknown index type', () => {
      expect(getMSCIThresholdIDR('bogus')).toBe(2_000_000_000 * USD_TO_IDR);
    });
  });

  describe('calculateFreeFloatMcap', () => {
    it('applies free float percentage', () => {
      expect(calculateFreeFloatMcap(1_000_000_000_000, 40)).toBe(400_000_000_000);
    });

    it('returns 0 for missing inputs', () => {
      expect(calculateFreeFloatMcap(0, 40)).toBe(0);
      expect(calculateFreeFloatMcap(1_000_000, 0)).toBe(0);
      expect(calculateFreeFloatMcap(null, null)).toBe(0);
    });
  });

  describe('calculateProgress', () => {
    const standardThresholdIDR = 2_000_000_000 * USD_TO_IDR;

    it('computes percentage of threshold', () => {
      expect(calculateProgress(standardThresholdIDR / 2, 'standard')).toBe(50);
    });

    it('returns 0 for empty values', () => {
      expect(calculateProgress(0, 'standard')).toBe(0);
      expect(calculateProgress(undefined, 'standard')).toBe(0);
    });

    it('caps at 999', () => {
      expect(calculateProgress(standardThresholdIDR * 20, 'standard')).toBe(999);
    });
  });

  describe('calculateTargetPrice', () => {
    it('scales price to reach threshold', () => {
      // freeFloatMcap at 10% of standard threshold -> 10x target price
      const freeFloatMcap = (2_000_000_000 * USD_TO_IDR) / 10;
      expect(calculateTargetPrice(100, freeFloatMcap, 'standard')).toBe(1000);
    });

    it('returns current price when threshold already met', () => {
      const threshold = 2_000_000_000 * USD_TO_IDR;
      expect(calculateTargetPrice(100, threshold * 2, 'standard')).toBe(100);
    });
  });

  describe('calculateUpside', () => {
    it('computes upside percentage', () => {
      expect(calculateUpside(100, 1000)).toBe(900);
    });

    it('returns 0 when no upside', () => {
      expect(calculateUpside(1000, 100)).toBe(0);
      expect(calculateUpside(100, 100)).toBe(0);
    });
  });

  describe('getStatusBadge', () => {
    it('labels by progress band', () => {
      expect(getStatusBadge(95)).toMatchObject({ label: 'Strong Candidate', variant: 'success' });
      expect(getStatusBadge(80)).toMatchObject({ label: 'Borderline', variant: 'warning' });
      expect(getStatusBadge(50)).toMatchObject({ label: 'Early Stage', variant: 'danger' });
    });
  });

  describe('calculateMSCIMetrics', () => {
    it('computes the full metric set', () => {
      const stock = {
        price: 100,
        market_cap: 1_000_000_000_000,
        free_float_percent: 50,
        msci_index: 'standard',
      };
      const metrics = calculateMSCIMetrics(stock);
      expect(metrics.freeFloatMcap).toBe(500_000_000_000);
      expect(metrics.progress).toBeCloseTo((500_000_000_000 / (2_000_000_000 * USD_TO_IDR)) * 100, 6);
      expect(metrics.targetPrice).toBe(100 * (2_000_000_000 * USD_TO_IDR) / 500_000_000_000);
      expect(metrics.thresholdIDR).toBe(2_000_000_000 * USD_TO_IDR);
      expect(metrics.upside).toBeCloseTo(((metrics.targetPrice - 100) / 100) * 100, 6);
      expect(metrics.status.label).toBe('Early Stage');
    });
  });

  describe('calculateSummaryStats', () => {
    it('returns zeros for empty input', () => {
      expect(calculateSummaryStats([])).toEqual({ totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 });
      expect(calculateSummaryStats(null)).toEqual({ totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 });
    });

    it('aggregates stock stats', () => {
      const stocks = [
        { progress: 50, free_float_percent: 20 },
        { progress: 90, free_float_percent: 40 },
      ];
      expect(calculateSummaryStats(stocks)).toEqual({ totalStocks: 2, nearestProgress: 90, averageFreeFloat: 30 });
    });
  });
});
