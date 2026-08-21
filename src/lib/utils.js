import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { isCryptoSymbol, toBybitSymbol } from "@/lib/bybit";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const stableColorCache = new Map();

function hashString(value) {
  let hash = 2166136261;
  const stringValue = String(value ?? "");

  for (let index = 0; index < stringValue.length; index += 1) {
    hash ^= stringValue.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getStableColorFromLabel(label) {
  const normalizedLabel = String(label ?? "").trim();

  if (!normalizedLabel) {
    return "hsl(210 70% 56%)";
  }

  if (stableColorCache.has(normalizedLabel)) {
    return stableColorCache.get(normalizedLabel);
  }

  const hash = hashString(normalizedLabel);
  const hue = hash % 360;
  const saturation = 66 + (hash % 9);
  const lightness = 48 + ((hash >>> 3) % 10);
  const color = `hsl(${hue} ${saturation}% ${lightness}%)`;

  stableColorCache.set(normalizedLabel, color);
  return color;
}

/**
 * Formats ticker symbol for display by removing the .JK suffix for Indonesian stocks
 * @param {string} symbol - The ticker symbol (e.g., "BBRI.JK", "AAPL")
 * @returns {string} - Formatted symbol (e.g., "BBRI", "AAPL")
 */
export function formatTickerDisplay(symbol) {
  if (!symbol || typeof symbol !== 'string') return symbol || '';
  if (isCryptoSymbol(symbol)) return toBybitSymbol(symbol);
  return symbol.replace(/\.JK$/i, '');
}

/**
 * Format market cap for display
 * @param {number} value - Market cap value
 * @returns {string} Formatted string (e.g., "15.2T", "450B")
 */
export function formatMarketCap(value) {
  if (!value) return '—';

  const trillion = 1_000_000_000_000;
  const billion = 1_000_000_000;
  const million = 1_000_000;

  if (value >= trillion) {
    return `${Number((value / trillion).toFixed(1))}T`;
  }
  if (value >= billion) {
    return `${Number((value / billion).toFixed(1))}B`;
  }
  if (value >= million) {
    return `${Number((value / million).toFixed(1))}M`;
  }
  return value.toLocaleString('id-ID');
}

/**
 * Format price for display
 * @param {number} value - Price value
 * @returns {string} Formatted price
 */
export function formatPrice(value, {
  locale = 'id-ID',
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
  fallback = '—',
  zeroIsEmpty = true,
} = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || (zeroIsEmpty && numeric === 0)) return fallback;
  return numeric.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

/**
 * Format percentage for display
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage
 */
export function formatPriceTrim(value, symbol, opts = {}) {
  const formatted = formatPrice(value, {
    locale: 'en-US',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    zeroIsEmpty: false,
    ...opts,
  });
  if (symbol?.endsWith('.JK') || symbol === 'BTC-USD') {
    return formatted.replace(/[.,]00$/, '');
  }
  return formatted;
}

export function formatPercent(value, {
  fractionDigits = 1,
  fallback = '—',
  showPositiveSign = false,
  nullAsZero = false,
} = {}) {
  const numeric = value == null && nullAsZero ? 0 : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const sign = showPositiveSign && numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(fractionDigits)}%`;
}

export function formatCompactNumber(value, { maximumFractionDigits = 1, fallback = '0' } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(numeric);
}

export function formatUSD(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatIDR(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function formatSGD(value) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatByCurrency(code, amount) {
  if (code === 'IDR') return formatIDR(amount);
  if (code === 'SGD') return formatSGD(amount);
  return formatUSD(amount);
}

export function getChangeTone(value) {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400';
}
