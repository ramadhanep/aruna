import YahooFinance from 'yahoo-finance2';

// Singleton client to share cookies/session and suppress noisy notices.
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export default yahooFinance;
