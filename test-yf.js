import yahooFinance from "yahoo-finance2";
console.log(yahooFinance.version);
try {
  let result = await yahooFinance.search('AAPL');
  console.log(result.quotes.length);
} catch (e) {
  console.error("error:", e.message);
}
