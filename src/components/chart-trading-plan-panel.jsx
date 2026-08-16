"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toFiniteNumber, TP_FALLBACK_META } from "@/lib/chart-helpers";
import { useTranslations } from "next-intl";

export function ChartTradingPlanPanel({
  payload,
  dateLabel,
  lotEligible,
  currencyCode,
  formatPriceValue,
  formatDetailedCurrency,
}) {
  const t = useTranslations("chartTradingPlan");
  const [entryInput, setEntryInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('');
  const [riskPercentInput, setRiskPercentInput] = useState('1');

  useEffect(() => {
    const seed = () => {
      if (!payload) {
        setEntryInput('');
        setBalanceInput('');
        setRiskPercentInput('1');
        return;
      }
      setEntryInput(
        payload.entry_price != null ? String(payload.entry_price) : ''
      );
      setBalanceInput(
        payload.account_size != null ? String(payload.account_size) : ''
      );
      setRiskPercentInput(
        payload.risk_percent != null ? String(payload.risk_percent) : '1'
      );
    };
    queueMicrotask(seed);
  }, [payload]);

  const formatPlanCurrencyValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const formatted = formatDetailedCurrency(value);
    return currencyCode ? `${formatted} ${currencyCode}` : formatted;
  }, [currencyCode, formatDetailedCurrency]);

  const formatPlanCurrencyDelta = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    const formatted = formatDetailedCurrency(Math.abs(numeric));
    const prefix = numeric >= 0 ? '+' : '-';
    return currencyCode ? `${prefix}${formatted} ${currencyCode}` : `${prefix}${formatted}`;
  }, [currencyCode, formatDetailedCurrency]);

  const entryPrice = useMemo(() => {
    const manual = toFiniteNumber(entryInput);
    if (manual != null && manual > 0) {
      return manual;
    }
    return toFiniteNumber(payload?.entry_price);
  }, [entryInput, payload]);

  const stopLossPrice = useMemo(() => toFiniteNumber(payload?.stop_loss), [payload]);

  const stopLossReason = useMemo(
    () => payload?.stop_loss_reason || t('stopLossReasonFallback'),
    [payload, t]
  );

  const stopLossPct = useMemo(() => {
    if (
      entryPrice == null ||
      entryPrice === 0 ||
      stopLossPrice == null
    ) {
      return null;
    }
    return ((stopLossPrice - entryPrice) / entryPrice) * 100;
  }, [entryPrice, stopLossPrice]);

  // Risk distance per unit (always positive for a valid long setup) — the backbone of every
  // R-multiple and position-sizing calculation below.
  const riskPerUnit = useMemo(() => {
    if (entryPrice == null || stopLossPrice == null) return null;
    const diff = entryPrice - stopLossPrice;
    return diff > 0 ? diff : null;
  }, [entryPrice, stopLossPrice]);

  const entryZone = useMemo(() => {
    const low = toFiniteNumber(payload?.entry_zone_low) ?? entryPrice;
    const high = toFiniteNumber(payload?.entry_zone_high) ?? entryPrice;
    return {
      low: low != null ? Math.min(low, high ?? low) : null,
      high: high != null ? Math.max(low ?? high, high) : null,
      type: payload?.entry_type || 'Market',
      reason: payload?.entry_reason || t('entryReasonFallback'),
    };
  }, [payload, entryPrice, t]);

  const targets = useMemo(() => {
    if (!payload?.tp_targets) {
      return [];
    }
    return payload.tp_targets
      .map((target, index) => {
        const price = toFiniteNumber(target?.price);
        if (price == null) {
          return null;
        }
        const fallback = TP_FALLBACK_META[index] || TP_FALLBACK_META[TP_FALLBACK_META.length - 1];
        const label = target?.label || `TP${index + 1}`;
        const diff = entryPrice != null ? price - entryPrice : null;
        const pct =
          entryPrice != null && entryPrice !== 0 && diff != null
            ? (diff / entryPrice) * 100
            : null;
        const rMultiple =
          riskPerUnit != null && diff != null ? diff / riskPerUnit : null;
        return {
          label,
          price,
          diff,
          pct,
          rMultiple,
          reason: target?.reason || fallback.reason,
          sellPercent: target?.sell_percent ?? fallback.sellPercent,
          action: target?.action || fallback.action,
        };
      })
      .filter(Boolean);
  }, [payload, entryPrice, riskPerUnit]);

  // Primary target used for the headline Risk:Reward figure and the calculator's expected
  // profit — the middle target (TP2 / measured-move) is the realistic, most-likely outcome.
  const primaryTarget = useMemo(() => {
    if (targets.length === 0) return null;
    const mid = Math.floor(targets.length / 2);
    return targets[mid] || targets[0];
  }, [targets]);

  const riskReward = useMemo(() => {
    const fromPayload = payload?.risk_reward;
    const perTarget = targets.map((target) => target.rMultiple ?? null);
    const primary =
      toFiniteNumber(fromPayload?.primary) ?? primaryTarget?.rMultiple ?? perTarget[perTarget.length - 1] ?? null;
    return { perTarget, primary };
  }, [payload, targets, primaryTarget]);

  const qualityTier = useMemo(() => {
    const rr = riskReward.primary;
    const tier = payload?.quality_tier ||
      (rr == null ? 'fair' : rr >= 3 ? 'excellent' : rr >= 2 ? 'good' : rr >= 1.2 ? 'fair' : 'poor');
    const meta = {
      excellent: { label: t('excellentSetup'), variant: 'success' },
      good: { label: t('goodSetup'), variant: 'success' },
      fair: { label: t('fairSetup'), variant: 'warning' },
      poor: { label: t('weakSetup'), variant: 'danger' },
    };
    return { tier, ...(meta[tier] || meta.fair) };
  }, [payload, riskReward, t]);

  const basisValues = useMemo(() => {
    if (!payload?.basis) {
      return { swing: null, swingHigh: null, ema: null, atr: null };
    }
    return {
      swing: toFiniteNumber(payload.basis.swing_low),
      swingHigh: toFiniteNumber(payload.basis.swing_high),
      ema: toFiniteNumber(payload.basis.ema20),
      atr: toFiniteNumber(payload.basis.atr),
    };
  }, [payload]);

  const technicalConfirmations = useMemo(() => {
    const items = [];
    items.push(t('priceReclaimed'));
    const volumeRatio = toFiniteNumber(payload?.volume_ratio);
    items.push(
      volumeRatio != null
        ? t('volumeRatio', { ratio: volumeRatio.toFixed(2) })
        : t('volumeAbove')
    );
    const slope = toFiniteNumber(payload?.ema_slope_pct);
    if (slope != null) {
      items.push(t('emaTrending', { slope: `${slope >= 0 ? '+' : ''}${slope.toFixed(2)}` }));
    }
    return items;
  }, [payload, t]);

  // --- Position size calculator: risk-first, never requires manual share math ---
  const balanceValue = useMemo(() => {
    const manual = toFiniteNumber(balanceInput);
    if (manual != null && manual > 0) return manual;
    return toFiniteNumber(payload?.account_size);
  }, [balanceInput, payload]);

  const riskPercentValue = useMemo(() => {
    const manual = toFiniteNumber(riskPercentInput);
    if (manual != null && manual > 0) return manual;
    return toFiniteNumber(payload?.risk_percent) ?? 1;
  }, [riskPercentInput, payload]);

  const maxRiskAmount = useMemo(() => {
    if (balanceValue == null || riskPercentValue == null) return null;
    return (balanceValue * riskPercentValue) / 100;
  }, [balanceValue, riskPercentValue]);

  const shareCount = useMemo(() => {
    if (maxRiskAmount == null || !riskPerUnit) return 0;
    return Math.max(Math.floor(maxRiskAmount / riskPerUnit), 0);
  }, [maxRiskAmount, riskPerUnit]);

  const lotCount = useMemo(() => {
    if (!lotEligible || shareCount <= 0) return null;
    return Math.floor(shareCount / 100);
  }, [lotEligible, shareCount]);

  const sizeSummary = useMemo(() => {
    if (shareCount <= 0) return null;
    const shareLabel = shareCount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (lotEligible) {
      const lotShares = (lotCount ?? 0) * 100;
      const lotLabel = (lotCount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
      return t('lotsSummary', { lots: lotLabel, shares: lotShares.toLocaleString('en-US') });
    }
    return t('sharesSummary', { shares: shareLabel });
  }, [shareCount, lotCount, lotEligible, t]);

  const positionCost = useMemo(() => {
    if (shareCount <= 0 || entryPrice == null) return null;
    return shareCount * entryPrice;
  }, [shareCount, entryPrice]);

  const expectedLoss = useMemo(() => {
    if (shareCount <= 0 || riskPerUnit == null) return null;
    return shareCount * riskPerUnit;
  }, [shareCount, riskPerUnit]);

  const expectedProfit = useMemo(() => {
    if (shareCount <= 0 || primaryTarget?.diff == null) return null;
    return shareCount * primaryTarget.diff;
  }, [shareCount, primaryTarget]);

  const calculatorRiskReward = useMemo(() => {
    if (expectedProfit == null || !expectedLoss) return riskReward.primary;
    return expectedProfit / expectedLoss;
  }, [expectedProfit, expectedLoss, riskReward]);

  if (!payload) {
    return (
      <div className="rounded-xl border border-border/60 py-10 px-4 flex flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-sm font-semibold text-foreground">{t('noPlanTitle')}</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {t('noPlanBody')}
        </p>
      </div>
    );
  }

  const rr = riskReward.primary;
  const rrLabel = rr != null ? `1 : ${rr.toFixed(1)}` : '—';
  const rrTone = rr == null
    ? 'text-muted-foreground'
    : rr >= 2
      ? 'text-emerald-600 dark:text-emerald-400'
      : rr >= 1.2
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  const perTargetRR = riskReward.perTarget;
  const firstRR = perTargetRR[0];
  const lastRR = perTargetRR[perTargetRR.length - 1];
  const riskPresets = [0.5, 1, 2];

  return (
    <div className="space-y-3 text-xs">
      {/* 1. Header + Trade Quality */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {dateLabel && (
            <span className="text-2xs text-muted-foreground/70 shrink-0">{dateLabel}</span>
          )}
        </div>
        <Badge variant={qualityTier.variant} className="shrink-0">
          {qualityTier.label}
        </Badge>
      </div>

      {/* 2. Risk : Reward — the headline metric */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wide text-muted-foreground mb-0.5">{t('riskReward')}</p>
          <p className={`text-2xl font-bold leading-none ${rrTone}`}>{rrLabel}</p>
          <p className="text-2xs text-muted-foreground mt-1.5">
            {t('riskToReach', {
              price: formatPriceValue(riskPerUnit),
              label: primaryTarget?.label ?? 'target',
              reason: primaryTarget?.reason ?? '—',
            })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xs text-muted-foreground mb-0.5">{t('rangeTp1Tp3')}</p>
          <p className="text-xs font-semibold text-foreground">
            {firstRR != null ? `1:${firstRR.toFixed(1)}` : '—'} → {lastRR != null ? `1:${lastRR.toFixed(1)}` : '—'}
          </p>
        </div>
      </div>

      {/* 3. Entry */}
      <div className="rounded-xl border border-border/60 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-1xs font-semibold text-foreground">{t('entry')}</p>
          <Badge className="border-transparent bg-primary/10 text-primary">
            {entryZone.type}
          </Badge>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-bold text-foreground">{formatPriceValue(entryPrice)}</p>
          <p className="text-2xs text-muted-foreground text-right">
            {t('buyZone', {
              low: formatPriceValue(entryZone.low),
              high: formatPriceValue(entryZone.high),
            })}
          </p>
        </div>
        <p className="text-2xs text-muted-foreground">{entryZone.reason}</p>
      </div>

      {/* 4. Stop Loss */}
      <div className="rounded-xl border border-border/60 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-1xs font-semibold text-foreground">{t('stopLoss')}</p>
          <span className="text-2xs font-semibold text-red-600 dark:text-red-400">
            {stopLossPct != null ? `${stopLossPct.toFixed(2)}%` : '—'}
          </span>
        </div>
        <p className="text-base font-bold text-red-600 dark:text-red-400">{formatPriceValue(stopLossPrice)}</p>
        <p className="text-2xs text-muted-foreground">{stopLossReason}</p>
      </div>

      {/* 5. Take Profit Strategy */}
      <div className="rounded-xl border border-border/60 p-3 space-y-2">
        <p className="text-1xs font-semibold text-foreground">{t('takeProfitStrategy')}</p>
        <div className="space-y-2">
          {targets.map((target) => (
            <div
              key={target.label}
              className="flex items-start justify-between gap-3 pb-2 border-b border-border/40 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{target.label}</span>
                  <span className="text-2xs text-muted-foreground truncate">{target.reason}</span>
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  {t('sellAction', { percent: target.sellPercent, action: target.action })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-foreground">{formatPriceValue(target.price)}</p>
                <p className="text-2xs text-emerald-600 dark:text-emerald-400">
                  {target.pct != null ? `+${target.pct.toFixed(1)}%` : '—'}
                  {target.rMultiple != null ? ` · ${target.rMultiple.toFixed(1)}R` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Position Size Calculator — risk-first, no manual share math */}
      <div className="rounded-xl border border-border/60 p-3 space-y-3">
        <p className="text-1xs font-semibold text-foreground">{t('positionSizeCalculator')}</p>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-2xs font-medium text-muted-foreground">{t('accountBalance')}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={balanceInput}
              onChange={(event) => setBalanceInput(event.target.value)}
              className="text-xs h-8"
              placeholder={t('balancePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-2xs font-medium text-muted-foreground">{t('riskPercent')}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={riskPercentInput}
              onChange={(event) => setRiskPercentInput(event.target.value)}
              className="text-xs h-8"
              placeholder="1"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <SegmentedControl
            value={String(riskPercentInput)}
            onValueChange={(value) => setRiskPercentInput(value)}
            variant="ghost"
            className="px-2 py-0.5 text-2xs rounded-full"
            activeClassName="bg-foreground text-background hover:bg-foreground/90 dark:hover:bg-foreground/90 shadow-sm"
            inactiveClassName="text-foreground hover:bg-accent hover:text-accent-foreground"
            options={riskPresets.map((preset) => ({ value: String(preset), label: `${preset}%` }))}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-2xs font-medium text-muted-foreground">{t('yourEntryPrice')}</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={entryInput}
            onChange={(event) => setEntryInput(event.target.value)}
            className="text-xs h-8"
            placeholder={payload?.entry_price ? t('defaultPrice', { price: payload.entry_price }) : t('entryPlaceholder')}
          />
        </div>

        <div className="rounded-lg bg-muted/30 p-2.5 grid grid-cols-2 gap-y-2.5 gap-x-2">
          <div>
            <p className="text-2xs text-muted-foreground">{t('maxRiskAmount')}</p>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{formatPlanCurrencyValue(maxRiskAmount)}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('positionSize')}</p>
            <p className="text-xs font-semibold text-foreground">{sizeSummary || '—'}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('positionCost')}</p>
            <p className="text-xs font-semibold text-foreground">{formatPlanCurrencyValue(positionCost)}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('riskReward')}</p>
            <p className="text-xs font-semibold text-foreground">
              {calculatorRiskReward != null ? `1 : ${calculatorRiskReward.toFixed(1)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('expectedLoss')}</p>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              {formatPlanCurrencyDelta(expectedLoss != null ? -expectedLoss : null)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('expectedProfit', { label: primaryTarget?.label ?? 'TP' })}</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {formatPlanCurrencyDelta(expectedProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* 7. Technical Confirmation */}
      <div className="rounded-xl border border-border/60 p-3 space-y-2">
        <p className="text-1xs font-semibold text-foreground">{t('technicalConfirmation')}</p>
        <ul className="space-y-1">
          {technicalConfirmations.map((line, index) => (
            <li key={index} className="flex items-start gap-1.5 text-1xs text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border/40">
          <div>
            <p className="text-2xs text-muted-foreground">{t('swingLow')}</p>
            <p className="text-1xs font-semibold">{formatPriceValue(basisValues.swing)}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('ema20')}</p>
            <p className="text-1xs font-semibold">{formatPriceValue(basisValues.ema)}</p>
          </div>
          <div>
            <p className="text-2xs text-muted-foreground">{t('atr14')}</p>
            <p className="text-1xs font-semibold">{formatPriceValue(basisValues.atr)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
