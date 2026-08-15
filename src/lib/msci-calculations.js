/**
 * MSCI Calculations Utility
 * Handles all MSCI-related calculations including thresholds, progress, and target prices
 */

// MSCI Thresholds in USD
export const MSCI_THRESHOLDS = {
  standard: 2_000_000_000, // $2B USD
  small_cap: 300_000_000,  // $300M USD
};

// Fallback USD/IDR rate used when no live rate is available
const FALLBACK_USD_TO_IDR = 15_800;

/**
 * Calculate free float market cap
 * @param {number} marketCap - Total market cap
 * @param {number} freeFloatPercent - Free float percentage (0-100)
 * @returns {number} Free float market cap
 */
export function calculateFreeFloatMcap(marketCap, freeFloatPercent) {
  if (!marketCap || !freeFloatPercent) return 0;
  return marketCap * (freeFloatPercent / 100);
}

/**
 * Calculate MSCI threshold in IDR
 * @param {string} indexType - 'standard' or 'small_cap'
 * @returns {number} Threshold in IDR
 */
export function getMSCIThresholdIDR(indexType, usdToIdr = FALLBACK_USD_TO_IDR) {
  const thresholdUSD = MSCI_THRESHOLDS[indexType] || MSCI_THRESHOLDS.standard;
  return thresholdUSD * usdToIdr;
}

/**
 * Calculate progress percentage toward MSCI threshold
 * @param {number} freeFloatMcap - Free float market cap in IDR
 * @param {string} indexType - 'standard' or 'small_cap'
 * @returns {number} Progress percentage (0-100+)
 */
export function calculateProgress(freeFloatMcap, indexType, usdToIdr = FALLBACK_USD_TO_IDR) {
  const threshold = getMSCIThresholdIDR(indexType, usdToIdr);
  if (!threshold || !freeFloatMcap) return 0;
  return Math.min((freeFloatMcap / threshold) * 100, 999);
}

/**
 * Calculate target price needed to meet MSCI threshold
 * @param {number} currentPrice - Current stock price
 * @param {number} freeFloatMcap - Current free float market cap
 * @param {string} indexType - 'standard' or 'small_cap'
 * @returns {number} Target price
 */
export function calculateTargetPrice(currentPrice, freeFloatMcap, indexType, usdToIdr = FALLBACK_USD_TO_IDR) {
  const threshold = getMSCIThresholdIDR(indexType, usdToIdr);
  if (!currentPrice || !freeFloatMcap || freeFloatMcap >= threshold) {
    return currentPrice;
  }
  const multiplier = threshold / freeFloatMcap;
  return currentPrice * multiplier;
}

/**
 * Calculate upside percentage from current price to target price
 * @param {number} currentPrice - Current stock price
 * @param {number} targetPrice - Target price for MSCI inclusion
 * @returns {number} Upside percentage
 */
export function calculateUpside(currentPrice, targetPrice) {
  if (!currentPrice || !targetPrice || currentPrice >= targetPrice) return 0;
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}

/**
 * Determine status badge based on progress
 * @param {number} progress - Progress percentage
 * @returns {object} Status object with label and color
 */
export function getStatusBadge(progress) {
  if (progress >= 90) {
    return {
      label: 'Strong Candidate',
      color: 'green',
      variant: 'success'
    };
  }
  if (progress >= 70) {
    return {
      label: 'Borderline',
      color: 'yellow',
      variant: 'warning'
    };
  }
  return {
    label: 'Early Stage',
    color: 'red',
    variant: 'danger'
  };
}

// Re-export shared format functions from utils for backward compatibility
export { formatMarketCap, formatPrice, formatPercent } from '@/lib/utils';


/**
 * Calculate all MSCI metrics for a stock
 * @param {object} stock - Stock object with price and fundamental data
 * @returns {object} Complete MSCI metrics
 */
export function calculateMSCIMetrics(stock, usdToIdr = FALLBACK_USD_TO_IDR) {
  const {
    price,
    market_cap,
    free_float_percent,
    msci_index,
  } = stock;

  // Calculate free float market cap
  const freeFloatMcap = calculateFreeFloatMcap(market_cap, free_float_percent);
  
  // Calculate progress toward threshold
  const progress = calculateProgress(freeFloatMcap, msci_index, usdToIdr);
  
  // Calculate target price
  const targetPrice = calculateTargetPrice(price, freeFloatMcap, msci_index, usdToIdr);
  
  // Calculate upside
  const upside = calculateUpside(price, targetPrice);
  
  // Get status badge
  const status = getStatusBadge(progress);

  return {
    freeFloatMcap,
    progress,
    targetPrice,
    upside,
    status,
    thresholdIDR: getMSCIThresholdIDR(msci_index, usdToIdr),
  };
}

/**
 * Calculate summary statistics for MSCI stocks
 * @param {array} stocks - Array of stock objects
 * @returns {object} Summary statistics
 */
export function calculateSummaryStats(stocks) {
  if (!stocks || stocks.length === 0) {
    return {
      totalStocks: 0,
      nearestProgress: 0,
      averageFreeFloat: 0,
    };
  }

  const totalStocks = stocks.length;
  const nearestProgress = Math.max(...stocks.map(s => s.progress || 0));
  const averageFreeFloat = stocks.reduce((sum, s) => sum + (s.free_float_percent || 0), 0) / totalStocks;

  return {
    totalStocks,
    nearestProgress,
    averageFreeFloat,
  };
}
