import YahooFinance from 'yahoo-finance2';

// ponytail: single request timeout for all Yahoo calls. Vercel Hobby functions
// cap at 60s; 20s per request leaves room for the screener batch loop to make
// progress instead of one hung call exhausting the whole invocation.
const REQUEST_TIMEOUT_MS = 20000;

const customFetch = async (url, options = {}) => {
  const signal =
    options.signal ??
    AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal,
      headers: {
        ...(options.headers || {}),
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
      },
    });
    return response;
  } finally {
    console.log(
      JSON.stringify({
        level: response?.ok ? 'info' : 'error',
        source: 'yahoo',
        url,
        status: response?.status ?? null,
        durationMs: Date.now() - startedAt,
      })
    );
  }
};

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  fetch: customFetch,
});

export default yahooFinance;
