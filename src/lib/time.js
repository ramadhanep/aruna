export const MOBILE_BREAKPOINT = 1024;
export const RECENT_PRICE_LOOKBACK_DAYS = 5;

export function getRecentUnixRange(days = RECENT_PRICE_LOOKBACK_DAYS, now = Date.now()) {
  const endDate = Math.floor(now / 1000);
  const startDate = endDate - 60 * 60 * 24 * days;

  return { startDate, endDate };
}
