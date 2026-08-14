import { describe, it, expect } from 'vitest';
import {
  clamp,
  toNumber,
  calculateVolumeSpike,
  calculateMoneyFlowScore,
  classifySignal,
  sortMoneyFlowReports,
  dedupeLatestBySymbol,
} from '@/lib/money-flow';

describe('money-flow', () => {
  describe('clamp', () => {
    it('clamps within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(20, 0, 10)).toBe(10);
    });

    it('returns min for non-finite values', () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
    });
  });

  describe('toNumber', () => {
    it('parses numbers and comma strings', () => {
      expect(toNumber(3.5)).toBe(3.5);
      expect(toNumber('1,234.5')).toBe(1234.5);
    });

    it('falls back for invalid input', () => {
      expect(toNumber('abc', 5)).toBe(5);
      expect(toNumber(null, 2)).toBe(2);
    });
  });

  describe('calculateVolumeSpike', () => {
    const chartData = {
      prices: Array.from({ length: 20 }, (_, i) => ({ value: 100 + i, volume: 1000 })),
    };
    it('computes spike from the last 20 volumes', () => {
      const result = calculateVolumeSpike(chartData);
      expect(result.avg_volume_20).toBe(1000);
      expect(result.volume_spike).toBe(1);
    });

    it('falls back to screener volumes', () => {
      const result = calculateVolumeSpike([], {}, { volume: '2000', previous_volume: '1000' });
      expect(result.volume_spike).toBe(2);
      expect(result.today_volume).toBe(2000);
    });

    it('falls back to bandar detector volumes', () => {
      const result = calculateVolumeSpike([], { volume: '5000', avg: { vol: '1000' } });
      expect(result.volume_spike).toBe(5);
    });

    it('returns zeros when nothing available', () => {
      expect(calculateVolumeSpike([], {}, null).volume_spike).toBe(0);
    });
  });

  describe('calculateMoneyFlowScore', () => {
    it('scores 100 when every component is maximal', () => {
      const result = calculateMoneyFlowScore({
        broker_accdist: 'big acc',
        top3_percent: 20,
        volume_spike: 4,
        price_change_1m: 0.25,
        total_buyer: 100,
        total_seller: 0,
        value: 1_000_000_000_000_0,
      });
      expect(result.score).toBe(100);
      expect(Object.values(result.breakdown).every((v) => v === 100)).toBe(true);
    });

    it('scores 0 when every component is minimal', () => {
      const result = calculateMoneyFlowScore({
        broker_accdist: 'big dist',
        top3_percent: 0,
        volume_spike: 0,
        price_change_1m: -0.15,
        total_buyer: 0,
        total_seller: 100,
        value: 0,
      });
      expect(result.score).toBe(0);
    });

    it('applies the documented weights', () => {
      // broker_accdist 'acc' (80) dominates: 80 * 0.3 = 24, others 0
      const result = calculateMoneyFlowScore({
        broker_accdist: 'acc',
        top3_percent: 0,
        volume_spike: 0,
        price_change_1m: -0.15,
        total_buyer: 0,
        total_seller: 100,
        value: 0,
      });
      expect(result.score).toBe(24);
      expect(result.breakdown.broker_accumulation).toBe(80);
    });
  });

  describe('classifySignal', () => {
    it('maps score bands to signals', () => {
      expect(classifySignal(80)).toBe('Strong Accumulation');
      expect(classifySignal(79.9)).toBe('Accumulation');
      expect(classifySignal(60)).toBe('Accumulation');
      expect(classifySignal(59.9)).toBe('Neutral');
      expect(classifySignal(40)).toBe('Neutral');
      expect(classifySignal(39.9)).toBe('Distribution');
    });

    it('defaults invalid scores to 0', () => {
      expect(classifySignal('abc')).toBe('Distribution');
    });
  });

  describe('sortMoneyFlowReports / dedupe', () => {
    it('sorts reports by score descending', () => {
      const reports = [
        { symbol: 'A', money_flow_score: 20 },
        { symbol: 'B', money_flow_score: 80 },
        { symbol: 'C', money_flow_score: 50 },
      ];
      const sorted = sortMoneyFlowReports(reports);
      expect(sorted.map((r) => r.symbol)).toEqual(['B', 'C', 'A']);
    });

    it('dedupes by symbol keeping the latest', () => {
      const reports = [
        { symbol: 'A', money_flow_score: 10, report_date: '2026-01-01' },
        { symbol: 'A', money_flow_score: 90, report_date: '2026-01-02' },
        { symbol: 'B', money_flow_score: 50, report_date: '2026-01-01' },
      ];
      const result = dedupeLatestBySymbol(reports);
      expect(result.map((r) => r.symbol)).toEqual(['A', 'B']);
      expect(result.find((r) => r.symbol === 'A').money_flow_score).toBe(90);
    });
  });
});
