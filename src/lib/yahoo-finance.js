import YahooFinance from 'yahoo-finance2';

const customFetch = async (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
    },
  });
};

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  fetch: customFetch,
});

export default yahooFinance;
