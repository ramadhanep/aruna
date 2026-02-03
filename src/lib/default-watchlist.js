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
];

export function getDefaultWatchlist() {
  return DEFAULT_WATCHLIST.map((item) => ({ ...item }));
}
