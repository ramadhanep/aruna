import yahooFinance from '@/lib/yahoo-finance';

/**
 * Yahoo Finance API proxy route
 * Fetches historical price data for a given symbol using yahoo-finance2 chart module
 * Supports different intervals, events (dividends/splits), and comprehensive OHLCV data
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('startDate'); // Unix timestamp
  const endDate = searchParams.get('endDate'); // Unix timestamp
  const interval = searchParams.get('interval') || '1d'; // Default to daily
  const events = searchParams.get('events'); // Optional: 'div|split|earn'
  const includePrePost = searchParams.get('includePrePost') === 'true'; // Pre/post market data

  if (!symbol || !startDate || !endDate) {
    return Response.json(
      { error: 'Missing required parameters: symbol, startDate, endDate' },
      { status: 400 }
    );
  }

  const start = Number(startDate);
  const end = Number(endDate);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Response.json(
      { error: 'Invalid date parameters; expected Unix timestamps' },
      { status: 400 }
    );
  }

  // Validate interval
  const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  if (!validIntervals.includes(interval)) {
    return Response.json(
      { error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` },
      { status: 400 }
    );
  }
  
  try {
    // Build chart options according to documentation
    const chartOptions = {
      period1: new Date(start * 1000),
      period2: new Date(end * 1000),
      interval,
    };

    // Add optional parameters
    if (events) {
      chartOptions.events = events;
    }
    if (includePrePost) {
      chartOptions.includePrePost = true;
    }

    const result = await yahooFinance.chart(symbol, chartOptions);

    // Handle empty results
    if (!result?.quotes || result.quotes.length === 0) {
      return Response.json(
        { error: 'No data available for the specified period. Symbol may be invalid or delisted.' },
        { status: 404 }
      );
    }

    // Extract quotes data (array format by default)
    const prices = result.quotes.map((quote) => ({
      date: quote.date.toISOString(),
      open: quote.open ?? null,
      high: quote.high ?? null,
      low: quote.low ?? null,
      close: quote.close ?? null,
      volume: quote.volume ?? null,
      adjclose: quote.adjclose ?? null,
    }));

    const meta = result.meta ?? {};

    // Process events if available
    const eventsData = {};
    if (result.events) {
      if (result.events.dividends) {
        eventsData.dividends = result.events.dividends.map(div => ({
          date: div.date.toISOString(),
          amount: div.amount,
        }));
      }
      if (result.events.splits) {
        eventsData.splits = result.events.splits.map(split => ({
          date: split.date.toISOString(),
          numerator: split.numerator,
          denominator: split.denominator,
          splitRatio: split.splitRatio,
        }));
      }
    }

    return Response.json({
      data: prices,
      events: Object.keys(eventsData).length > 0 ? eventsData : undefined,
      meta: {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol || symbol,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        fullExchangeName: meta.fullExchangeName,
        instrumentType: meta.instrumentType,
        firstTradeDate: meta.firstTradeDate,
        regularMarketTime: meta.regularMarketTime,
        regularMarketPrice: meta.regularMarketPrice,
        chartPreviousClose: meta.chartPreviousClose,
        previousClose: meta.previousClose,
        scale: meta.scale,
        priceHint: meta.priceHint,
        dataGranularity: meta.dataGranularity,
        range: meta.range,
        validRanges: meta.validRanges,
        gmtoffset: meta.gmtoffset,
        timezone: meta.exchangeTimezoneName,
        currentTradingPeriod: meta.currentTradingPeriod,
        marketState: meta.marketState, // Add marketState for pages to detect market status
        provider: 'yahoo-finance2',
      },
    });
  } catch (error) {
    console.error('Error fetching Yahoo Finance chart data:', error);
    
    // Provide more specific error messages
    let message = error?.message || 'Failed to fetch data from Yahoo Finance';
    let status = 500;
    
    if (message.includes('No data found')) {
      message = 'Symbol may be invalid, delisted, or no data available for the requested period';
      status = 404;
    } else if (message.includes('Invalid cookie')) {
      message = 'Yahoo Finance API session error. Please try again.';
    }
    
    return Response.json({ error: message }, { status });
  }
}
