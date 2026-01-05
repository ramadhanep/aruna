import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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
