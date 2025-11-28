export const DEFAULT_WATCHLIST = [
  { symbol: "BBCA.JK", order: 1 },
  { symbol: "BTC-USD", order: 2 },
  { symbol: "QQQ", order: 3 },
  { symbol: "SPY", order: 4 },
  { symbol: "NVDA", order: 5 },
  { symbol: "MSFT", order: 6 },
  { symbol: "AMZN", order: 7 },
  { symbol: "GOOG", order: 8 },
  { symbol: "AVGO", order: 9 },
];

export function getDefaultWatchlist() {
  return DEFAULT_WATCHLIST.map((item) => ({ ...item }));
}
