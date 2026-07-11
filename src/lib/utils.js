import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

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
    return `${(value / trillion).toFixed(1)}T`;
  }
  if (value >= billion) {
    return `${(value / billion).toFixed(1)}B`;
  }
  if (value >= million) {
    return `${(value / million).toFixed(1)}M`;
  }
  return value.toLocaleString('id-ID');
}

/**
 * Format price for display
 * @param {number} value - Price value
 * @returns {string} Formatted price
 */
export function formatPrice(value) {
  if (!value) return '—';
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format percentage for display
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage
 */
export function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}
