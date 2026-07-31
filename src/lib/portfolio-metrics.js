import { formatUSD, formatIDR, formatSGD, formatTickerDisplay } from '@/lib/utils';

export function isIDRSymbol(symbol) {
  return symbol.endsWith('.JK');
}

export function isLotUnit(unit) {
  return unit === 'lot';
}

export function getEffectiveAmount(amount, unit) {
  return isLotUnit(unit) ? amount * 100 : amount;
}

export function toUSD(symbol, pricePerUnit, fxRate) {
  if (pricePerUnit == null) return 0;
  if (fxRate <= 0) return pricePerUnit;
  return isIDRSymbol(symbol) ? pricePerUnit * fxRate : pricePerUnit;
}

export function usdToIdr(usdAmount, idrPerUsd) {
  if (idrPerUsd <= 0) return 0;
  return usdAmount * idrPerUsd;
}

export function usdToSgd(usdAmount, sgdPerUsd) {
  if (sgdPerUsd <= 0) return 0;
  return usdAmount * sgdPerUsd;
}

export function formatValue(usdAmount, currency, idrPerUsd, sgdPerUsd) {
  const idrAmount = usdToIdr(usdAmount, idrPerUsd);
  const sgdAmount = usdToSgd(usdAmount, sgdPerUsd);
  if (currency === 'IDR') {
    if (idrPerUsd <= 0) {
      return { primary: formatUSD(usdAmount), secondary: 'IDR FX unavailable', tertiary: formatSGD(sgdAmount) };
    }
    return { primary: formatIDR(idrAmount), secondary: formatUSD(usdAmount), tertiary: formatSGD(sgdAmount) };
  }
  if (currency === 'SGD') {
    if (sgdPerUsd <= 0) {
      return { primary: formatUSD(usdAmount), secondary: 'SGD FX unavailable', tertiary: formatIDR(idrAmount) };
    }
    return { primary: formatSGD(sgdAmount), secondary: formatUSD(usdAmount), tertiary: formatIDR(idrAmount) };
  }
  return { primary: formatUSD(usdAmount), secondary: formatIDR(idrAmount), tertiary: formatSGD(sgdAmount) };
}

export function computeHoldingsMetrics(entries, priceMap, fxRate, sgdPerUsd) {
  return entries.map((entry, index) => {
    const isCash = entry.type === 'cash';
    const effectiveAmount = isCash ? 1 : getEffectiveAmount(entry.amount, entry.unit);
    const baseValueUSD = isCash
      ? entry.avgPrice * entry.amount
      : toUSD(entry.symbol, entry.avgPrice, fxRate) * effectiveAmount;
    const livePrice = priceMap[entry.symbol];
    const currentValueUSD = isCash
      ? baseValueUSD
      : (livePrice != null
        ? toUSD(entry.symbol, livePrice, fxRate) * effectiveAmount
        : baseValueUSD);
    const pnl = currentValueUSD - baseValueUSD;
    const cashDisplayAmount = isCash
      ? (typeof entry.nativeAmount === 'number'
        ? entry.nativeAmount
        : (entry.cashCurrency === 'IDR' && fxRate > 0
          ? baseValueUSD / fxRate
          : (entry.cashCurrency === 'SGD' && sgdPerUsd > 0
            ? baseValueUSD * sgdPerUsd
            : baseValueUSD)))
      : null;
    return { entry, index, isCash, effectiveAmount, baseValueUSD, currentValueUSD, pnl, cashDisplayAmount };
  });
}

function compareAlphaDigital(a, b) {
  return (a.entry.symbol || '').localeCompare(b.entry.symbol || '');
}

function compareAlphaCash(a, b) {
  return (a.entry.category || a.entry.symbol || '').localeCompare(b.entry.category || b.entry.symbol || '');
}

function sortWithFallback(arr, comparator, fallback) {
  arr.sort((a, b) => {
    const result = comparator(a, b);
    if (result !== 0) return result;
    return fallback(a, b);
  });
}

export function sortHoldings(holdingsWithMetrics, sortKey) {
  const digital = holdingsWithMetrics.filter((item) => !item.isCash);
  const cash = holdingsWithMetrics.filter((item) => item.isCash);

  if (sortKey === 'market') {
    sortWithFallback(digital, (a, b) => b.currentValueUSD - a.currentValueUSD, compareAlphaDigital);
    sortWithFallback(cash, (a, b) => b.currentValueUSD - a.currentValueUSD, compareAlphaCash);
  } else if (sortKey === 'pnl') {
    sortWithFallback(digital, (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0), compareAlphaDigital);
    sortWithFallback(cash, (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0), compareAlphaCash);
  } else {
    sortWithFallback(digital, compareAlphaDigital, compareAlphaDigital);
    sortWithFallback(cash, compareAlphaCash, compareAlphaCash);
  }

  return [...digital, ...cash];
}

export function computePortfolioSummary(entries, priceMap, fxRate) {
  const digitalEntries = entries.filter((e) => e.type !== 'cash');
  const cashEntries = entries.filter((e) => e.type === 'cash');

  const digitalCost = digitalEntries.reduce((sum, e) => {
    const effective = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, e.avgPrice, fxRate) * effective;
  }, 0);

  const digitalMarket = digitalEntries.reduce((sum, e) => {
    const live = priceMap[e.symbol];
    const price = live != null ? live : e.avgPrice;
    const effective = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, price, fxRate) * effective;
  }, 0);

  const digitalPnL = digitalMarket - digitalCost;

  const totalCash = cashEntries.reduce((sum, e) => {
    return sum + e.avgPrice * e.amount;
  }, 0);

  const totalNetWorth = digitalMarket + totalCash;
  return { digitalCost, digitalMarket, digitalPnL, totalCash, totalNetWorth, totalPnL: digitalPnL };
}

export function computeDigitalAllocation(holdingsWithMetrics, logoMap) {
  return holdingsWithMetrics
    .filter((h) => !h.isCash)
    .map((h) => ({
      name: formatTickerDisplay(h.entry.symbol),
      symbol: h.entry.symbol,
      logo: logoMap[h.entry.symbol] || null,
      value: h.currentValueUSD,
    }));
}

export function computeCashTypeAllocation(holdingsWithMetrics) {
  const totals = new Map();
  holdingsWithMetrics
    .filter((h) => h.isCash)
    .forEach((h) => {
      const code = h.entry.cashCurrency || 'USD';
      totals.set(code, (totals.get(code) || 0) + h.currentValueUSD);
    });
  return [...totals.entries()].map(([code, value]) => ({ name: code, value }));
}
