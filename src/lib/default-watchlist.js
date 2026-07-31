export const DEFAULT_WATCHLIST = [
  { symbol: "BBCA.JK", order: 1 },
  { symbol: "BBRI.JK", order: 2 },
  { symbol: "BMRI.JK", order: 3 },
  { symbol: "BTC-USD", order: 4 },
  { symbol: "QQQ", order: 5 },
  { symbol: "SPY", order: 6 },
  { symbol: "NVDA", order: 7 },
  { symbol: "MSFT", order: 8 },
  { symbol: "AMZN", order: 9 },
  { symbol: "GOOG", order: 10 },
  { symbol: "AVGO", order: 11 },
  { symbol: "MU", order: 12 },
];

export function getDefaultWatchlist() {
  return DEFAULT_WATCHLIST.map((item) => ({ ...item }));
}

const WATCHLIST_STORAGE_KEY = "aruna_watchlist";

function parseStoredWatchlist(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item, index) => ({
        symbol: typeof item?.symbol === "string" ? item.symbol.trim() : null,
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      }))
      .filter((item) => item.symbol && item.symbol.length > 0);
  } catch {
    return null;
  }
}

export function readStoredWatchlist() {
  if (typeof window === "undefined") return null;
  return parseStoredWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY));
}

export function writeStoredWatchlist(items) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items ?? []));
  } catch {
    // Ignore storage failures; watchlist simply won't persist locally.
  }
}
