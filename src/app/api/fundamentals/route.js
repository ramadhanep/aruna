import yahooFinance from '@/lib/yahoo-finance';

const TYPE_MAPPING = {
  trailingMarketCap: { period: 'trailing', metric: 'marketCap' },
  quarterlyMarketCap: { period: 'quarterly', metric: 'marketCap' },
  trailingPeRatio: { period: 'trailing', metric: 'peRatio' },
  quarterlyPeRatio: { period: 'quarterly', metric: 'peRatio' },
  trailingForwardPeRatio: { period: 'trailing', metric: 'forwardPeRatio' },
  quarterlyForwardPeRatio: { period: 'quarterly', metric: 'forwardPeRatio' },
  trailingPsRatio: { period: 'trailing', metric: 'psRatio' },
  quarterlyPsRatio: { period: 'quarterly', metric: 'psRatio' },
  trailingPbRatio: { period: 'trailing', metric: 'pbRatio' },
  quarterlyPbRatio: { period: 'quarterly', metric: 'pbRatio' },
  trailingEnterprisesValueEBITDARatio: { period: 'trailing', metric: 'evToEbitda' },
  quarterlyEnterprisesValueEBITDARatio: { period: 'quarterly', metric: 'evToEbitda' },
  trailingEnterpriseValue: { period: 'trailing', metric: 'enterpriseValue' },
  quarterlyEnterpriseValue: { period: 'quarterly', metric: 'enterpriseValue' },
  trailingEnterprisesValueRevenueRatio: { period: 'trailing', metric: 'evToRevenue' },
  quarterlyEnterprisesValueRevenueRatio: { period: 'quarterly', metric: 'evToRevenue' },
  trailingPegRatio: { period: 'trailing', metric: 'pegRatio' },
  quarterlyPegRatio: { period: 'quarterly', metric: 'pegRatio' },
};

const toPlainValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') {
    return value.raw ?? value.fmt ?? null;
  }
  return value;
};

const formatRange = (low, high) => {
  const lowVal = toPlainValue(low);
  const highVal = toPlainValue(high);
  if (lowVal == null || highVal == null) return null;
  return `${lowVal} - ${highVal}`;
};

const parseTimeseries = (timeseriesData) => {
  const metrics = { trailing: {}, quarterly: {} };

  if (!timeseriesData) {
    return metrics;
  }

  // Process quarterly data (array of results with financial metrics)
  if (Array.isArray(timeseriesData.quarterly) && timeseriesData.quarterly.length > 0) {
    const entries = timeseriesData.quarterly
      .map((entry) => {
        if (!entry || !entry.date) return null;
        
        return {
          date: entry.date instanceof Date ? entry.date.toISOString().slice(0, 10) : entry.date,
          timestamp: entry.date instanceof Date ? entry.date.getTime() : Date.parse(entry.date),
          // Extract key financial metrics from quarterly data
          totalRevenue: entry.quarterlyTotalRevenue ?? null,
          netIncome: entry.quarterlyNetIncome ?? null,
          operatingIncome: entry.quarterlyOperatingIncome ?? null,
          grossProfit: entry.quarterlyGrossProfit ?? null,
          ebitda: entry.quarterlyEBITDA ?? null,
          ebit: entry.quarterlyEBIT ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length > 0) {
      metrics.quarterly.financials = entries;
    }
  }

  // Process trailing data
  if (Array.isArray(timeseriesData.trailing) && timeseriesData.trailing.length > 0) {
    const entries = timeseriesData.trailing
      .map((entry) => {
        if (!entry || !entry.date) return null;
        
        return {
          date: entry.date instanceof Date ? entry.date.toISOString().slice(0, 10) : entry.date,
          timestamp: entry.date instanceof Date ? entry.date.getTime() : Date.parse(entry.date),
          // Extract key financial metrics from trailing data
          totalRevenue: entry.trailingTotalRevenue ?? null,
          netIncome: entry.trailingNetIncome ?? null,
          operatingIncome: entry.trailingOperatingIncome ?? null,
          grossProfit: entry.trailingGrossProfit ?? null,
          ebitda: entry.trailingEBITDA ?? null,
          ebit: entry.trailingEBIT ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length > 0) {
      metrics.trailing.financials = entries;
    }
  }

  return metrics;
};

// Extract valuation metrics from quote data
const extractValuationMetrics = (quote) => {
  if (!quote) return { trailing: {}, quarterly: {} };

  const now = new Date().toISOString().slice(0, 10);
  const timestamp = Date.now();

  // Create single-point arrays for valuation metrics (for chart compatibility)
  const trailing = {};
  const quarterly = {};

  // Market Cap
  if (quote.marketCap != null) {
    const value = toPlainValue(quote.marketCap);
    if (value != null) {
      trailing.marketCap = [{ date: now, timestamp, value, currency: quote.currency }];
      quarterly.marketCap = [{ date: now, timestamp, value, currency: quote.currency }];
    }
  }

  // P/E Ratio
  if (quote.trailingPE != null) {
    const value = toPlainValue(quote.trailingPE);
    if (value != null) {
      trailing.peRatio = [{ date: now, timestamp, value }];
    }
  }

  // Forward P/E
  if (quote.forwardPE != null) {
    const value = toPlainValue(quote.forwardPE);
    if (value != null) {
      trailing.forwardPeRatio = [{ date: now, timestamp, value }];
      quarterly.forwardPeRatio = [{ date: now, timestamp, value }];
    }
  }

  // P/B Ratio
  if (quote.priceToBook != null) {
    const value = toPlainValue(quote.priceToBook);
    if (value != null) {
      trailing.pbRatio = [{ date: now, timestamp, value }];
      quarterly.pbRatio = [{ date: now, timestamp, value }];
    }
  }

  // P/S Ratio (Price to Sales)
  if (quote.priceToSalesTrailing12Months != null) {
    const value = toPlainValue(quote.priceToSalesTrailing12Months);
    if (value != null) {
      trailing.psRatio = [{ date: now, timestamp, value }];
    }
  }

  // EV/EBITDA
  if (quote.enterpriseToEbitda != null) {
    const value = toPlainValue(quote.enterpriseToEbitda);
    if (value != null) {
      trailing.evToEbitda = [{ date: now, timestamp, value }];
      quarterly.evToEbitda = [{ date: now, timestamp, value }];
    }
  }

  // Enterprise Value
  if (quote.enterpriseValue != null) {
    const value = toPlainValue(quote.enterpriseValue);
    if (value != null) {
      trailing.enterpriseValue = [{ date: now, timestamp, value, currency: quote.currency }];
      quarterly.enterpriseValue = [{ date: now, timestamp, value, currency: quote.currency }];
    }
  }

  // EV/Revenue
  if (quote.enterpriseToRevenue != null) {
    const value = toPlainValue(quote.enterpriseToRevenue);
    if (value != null) {
      trailing.evToRevenue = [{ date: now, timestamp, value }];
      quarterly.evToRevenue = [{ date: now, timestamp, value }];
    }
  }

  // PEG Ratio
  if (quote.pegRatio != null) {
    const value = toPlainValue(quote.pegRatio);
    if (value != null) {
      trailing.pegRatio = [{ date: now, timestamp, value }];
      quarterly.pegRatio = [{ date: now, timestamp, value }];
    }
  }

  return { trailing, quarterly };
};

const getLatestValue = (metrics, period, metric) => {
  const series = metrics?.[period]?.[metric];
  if (!series || series.length === 0) return null;
  return series[series.length - 1];
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const symbolKey = symbol.trim().toUpperCase();
  let quote = null;
  let timeseriesData = null;

  try {
    // Fetch quote data with proper options according to documentation
    quote = await yahooFinance.quote(symbolKey, {
      lang: 'en-US',
      region: 'US',
    });
  } catch (error) {
    console.warn(`Failed to fetch quote for ${symbolKey}`, error);
  }

  // Fetch both quarterly and trailing data separately as per documentation
  try {
    const now = Date.now();
    const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;
    const start = new Date(now - fiveYearsMs);
    const end = new Date(now);

    // Fetch quarterly data
    const quarterlyData = await yahooFinance.fundamentalsTimeSeries(symbolKey, {
      period1: start,
      period2: end,
      type: 'quarterly',
      module: 'financials', // Get income statement data
      lang: 'en-US',
    });

    // Fetch trailing data
    const trailingData = await yahooFinance.fundamentalsTimeSeries(symbolKey, {
      period1: start,
      period2: end,
      type: 'trailing',
      module: 'financials',
      lang: 'en-US',
    });

    // Combine the results
    timeseriesData = {
      quarterly: quarterlyData,
      trailing: trailingData,
    };
  } catch (error) {
    console.warn(`Failed to fetch fundamentals timeseries for ${symbolKey}`, error);
  }

  // Check if we have any data
  if (!quote && !timeseriesData) {
    return Response.json({ 
      error: `No fundamentals data found for ${symbolKey}. Symbol may be invalid or not supported.` 
    }, { status: 404 });
  }

  const metrics = parseTimeseries(timeseriesData);
  
  // Extract valuation metrics from quote and merge with financial metrics
  const valuationMetrics = extractValuationMetrics(quote);
  
  // Merge valuation metrics into metrics object
  if (valuationMetrics.trailing) {
    metrics.trailing = { ...metrics.trailing, ...valuationMetrics.trailing };
  }
  if (valuationMetrics.quarterly) {
    metrics.quarterly = { ...metrics.quarterly, ...valuationMetrics.quarterly };
  }

  // Validate data completeness
  const hasQuarterlyData = metrics?.quarterly?.financials?.length > 0;
  const hasTrailingData = metrics?.trailing?.financials?.length > 0;
  
  if (!hasQuarterlyData && !hasTrailingData) {
    console.warn(`No financial time series data available for ${symbolKey}`);
  }

  const profile = quote
    ? {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.symbol,
        exchange: quote.fullExchangeName || quote.exchange,
        exchangeCode: quote.exchange,
        currency: quote.currency,
        quoteType: quote.quoteType, // e.g., 'EQUITY', 'ETF', 'MUTUALFUND', etc.
        marketState: quote.marketState,
        marketTime:
          quote.regularMarketTime?.fmt ||
          (quote.regularMarketTime != null ? String(quote.regularMarketTime) : null),
        // Additional metadata based on quote type
        sector: quote.sector || null,
        industry: quote.industry || null,
        logoUrl: quote.logoUrl || quote.companyLogoUrl || null,
        // ETF-specific fields
        netAssets: quote.netAssets || null,
        netExpenseRatio: quote.netExpenseRatio || null,
        // Fund-specific fields  
        dividendRate: quote.dividendRate || null,
        dividendYield: toPlainValue(quote.dividendYield) || null,
      }
    : null;

  const price = quote
    ? {
        current: toPlainValue(quote.regularMarketPrice),
        change: toPlainValue(quote.regularMarketChange),
        changePercent: toPlainValue(quote.regularMarketChangePercent),
        previousClose: toPlainValue(quote.regularMarketPreviousClose),
        open: toPlainValue(quote.regularMarketOpen),
        dayHigh: toPlainValue(quote.regularMarketDayHigh),
        dayLow: toPlainValue(quote.regularMarketDayLow),
        dayRange: formatRange(quote.regularMarketDayLow, quote.regularMarketDayHigh),
        fiftyTwoWeekRange: formatRange(quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: toPlainValue(quote.fiftyTwoWeekLow),
        fiftyTwoWeekHigh: toPlainValue(quote.fiftyTwoWeekHigh),
        volume:
          quote.regularMarketVolume?.longFmt ||
          quote.regularMarketVolume?.fmt ||
          quote.regularMarketVolume,
        marketCap: toPlainValue(quote.marketCap),
        preMarket:
          quote.preMarketPrice?.fmt || quote.preMarketChangePercent?.fmt
            ? {
                price: quote.preMarketPrice?.fmt || toPlainValue(quote.preMarketPrice),
                change: quote.preMarketChange?.fmt || toPlainValue(quote.preMarketChange),
                changePercent:
                  quote.preMarketChangePercent?.fmt ||
                  toPlainValue(quote.preMarketChangePercent),
                time:
                  quote.preMarketTime?.fmt ||
                  (quote.preMarketTime != null ? String(quote.preMarketTime) : null),
              }
            : null,
        postMarket:
          quote.postMarketPrice?.fmt || quote.postMarketChangePercent?.fmt
            ? {
                price: quote.postMarketPrice?.fmt || toPlainValue(quote.postMarketPrice),
                change: quote.postMarketChange?.fmt || toPlainValue(quote.postMarketChange),
                changePercent:
                  quote.postMarketChangePercent?.fmt ||
                  toPlainValue(quote.postMarketChangePercent),
                time:
                  quote.postMarketTime?.fmt ||
                  (quote.postMarketTime != null ? String(quote.postMarketTime) : null),
              }
            : null,
      }
    : null;

  const latest = {
    trailing: {
      marketCap: getLatestValue(metrics, 'trailing', 'marketCap'),
      peRatio: getLatestValue(metrics, 'trailing', 'peRatio'),
      pbRatio: getLatestValue(metrics, 'trailing', 'pbRatio'),
      psRatio: getLatestValue(metrics, 'trailing', 'psRatio'),
      evToEbitda: getLatestValue(metrics, 'trailing', 'evToEbitda'),
      forwardPeRatio: getLatestValue(metrics, 'trailing', 'forwardPeRatio'),
      pegRatio: getLatestValue(metrics, 'trailing', 'pegRatio'),
      enterpriseValue: getLatestValue(metrics, 'trailing', 'enterpriseValue'),
      evToRevenue: getLatestValue(metrics, 'trailing', 'evToRevenue'),
      financials: getLatestValue(metrics, 'trailing', 'financials'),
    },
    quarterly: {
      marketCap: getLatestValue(metrics, 'quarterly', 'marketCap'),
      peRatio: getLatestValue(metrics, 'quarterly', 'peRatio'),
      pbRatio: getLatestValue(metrics, 'quarterly', 'pbRatio'),
      psRatio: getLatestValue(metrics, 'quarterly', 'psRatio'),
      evToEbitda: getLatestValue(metrics, 'quarterly', 'evToEbitda'),
      forwardPeRatio: getLatestValue(metrics, 'quarterly', 'forwardPeRatio'),
      pegRatio: getLatestValue(metrics, 'quarterly', 'pegRatio'),
      enterpriseValue: getLatestValue(metrics, 'quarterly', 'enterpriseValue'),
      evToRevenue: getLatestValue(metrics, 'quarterly', 'evToRevenue'),
      financials: getLatestValue(metrics, 'quarterly', 'financials'),
    },
  };

  return Response.json({
    profile,
    price,
    metrics,
    latest,
    source: { provider: 'yahoo-finance2' },
  });
}
