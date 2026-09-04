import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';
import { writeYahooRawLog } from '@/lib/yahoo-raw-log';

// In-memory cache for fundamentals (5 min TTL). Key: symbol, Value: { data, expiresAt }
const fundamentalsCache = new Map();
const FUNDAMENTALS_TTL = 5 * 60 * 1000;

function getCachedFundamentals(symbol) {
  const entry = fundamentalsCache.get(symbol);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  fundamentalsCache.delete(symbol);
  return null;
}

function setCachedFundamentals(symbol, data) {
  // Cap cache size to prevent memory leaks
  if (fundamentalsCache.size > 200) {
    const oldest = fundamentalsCache.keys().next().value;
    fundamentalsCache.delete(oldest);
  }
  fundamentalsCache.set(symbol, { data, expiresAt: Date.now() + FUNDAMENTALS_TTL });
}

const toPlainValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') {
    if (value.raw != null) return value.raw;
    if (value.fmt != null) return value.fmt;
    if (value.longFmt != null) return value.longFmt;
    if (value.shortFmt != null) return value.shortFmt;
  }
  return value;
};

const simplifyValue = (value) => {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => simplifyValue(entry));
  }
  if (typeof value === 'object') {
    if ('raw' in value || 'fmt' in value || 'longFmt' in value || 'shortFmt' in value) {
      return toPlainValue(value);
    }
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = simplifyValue(val);
      return acc;
    }, {});
  }
  return value;
};

const toNumber = (value) => {
  const plain = toPlainValue(value);
  if (plain == null) return null;
  if (typeof plain === 'number' && Number.isFinite(plain)) return plain;
  if (typeof plain === 'string') {
    const cleaned = plain.replace(/,/g, '');
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const formatRange = (low, high) => {
  const lowVal = toPlainValue(low);
  const highVal = toPlainValue(high);
  if (lowVal == null || highVal == null) return null;
  return `${lowVal} - ${highVal}`;
};

// Converts a timestamp value (Date object or primitive) to an ISO 8601 string
const toISOStr = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

const mapEarningsSeries = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((entry) => {
      const period = entry.period || entry.date || entry.year || '';
      if (!period) return null;

      const actual = toNumber(entry.actual);
      const estimate = toNumber(entry.estimate);
      const surprise = toNumber(entry.surprise);
      const surprisePercent = toNumber(entry.surprisePercent);

      return {
        period,
        actual,
        estimate,
        surprise: surprise != null ? surprise : (actual != null && estimate != null ? actual - estimate : null),
        surprisePercent,
      };
    })
    .filter(Boolean);
};

const mapFinancialsSeries = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((entry) => {
      const period = entry.period || entry.date || entry.year || '';
      if (!period) return null;

      return {
        period,
        revenue: toNumber(entry.revenue),
        earnings: toNumber(entry.earnings),
      };
    })
    .filter(Boolean);
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return Response.json({ payload: encodePayload({ error: 'Missing symbol parameter' }) }, { status: 400 });
  }

  const symbolKey = symbol.trim().toUpperCase();

  // Check cache first
  const cached = getCachedFundamentals(symbolKey);
  if (cached) {
    return Response.json({ payload: encodePayload(cached) });
  }

  const modules = [
    'earnings',
    'assetProfile',
    'summaryDetail',
    'defaultKeyStatistics',
    'financialData',
    'recommendationTrend',
    'calendarEvents',
    'upgradeDowngradeHistory',
  ];

  // Run both Yahoo Finance calls in parallel — they are independent.
  const [quote, summaryModules] = await Promise.all([
    // 1) Quote
    (async () => {
      try {
        const q = await yahooFinance.quote(symbolKey, {
          lang: 'en-US',
          region: 'US',
        });
        await writeYahooRawLog({
          endpoint: 'fundamentals-quote',
          symbol: symbolKey,
          requestParams: { lang: 'en-US', region: 'US' },
          payload: q,
        });
        return q;
      } catch (error) {
        console.warn(`Failed to fetch quote for ${symbolKey}`, error);
        return null;
      }
    })(),

    // 2) QuoteSummary
    (async () => {
      try {
        const s = await yahooFinance.quoteSummary(symbolKey, { modules });
        await writeYahooRawLog({
          endpoint: 'fundamentals-quoteSummary',
          symbol: symbolKey,
          requestParams: { modules },
          payload: s,
        });
        return s;
      } catch (error) {
        if (error?.name === 'FailedYahooValidationError') {
          console.warn(`Yahoo schema validation failed for ${symbolKey}, retrying without validation`, error);
          try {
            const s2 = await yahooFinance.quoteSummary(
              symbolKey,
              { modules },
              { validateResult: false }
            );
            await writeYahooRawLog({
              endpoint: 'fundamentals-quoteSummary-unvalidated',
              symbol: symbolKey,
              requestParams: { modules, validateResult: false },
              payload: s2,
            });
            return s2;
          } catch (retryError) {
            console.warn(`Retry without validation also failed for ${symbolKey}`, retryError);
            return null;
          }
        }
        console.warn(`Failed to fetch fundamentals summary for ${symbolKey}`, error);
        return null;
      }
    })(),
  ]);

  const earningsSummary = summaryModules?.earnings ?? null;
  const assetProfile = summaryModules?.assetProfile ?? null;
  const summaryDetail = summaryModules?.summaryDetail ?? null;
  const defaultKeyStatistics = summaryModules?.defaultKeyStatistics ?? null;
  const financialData = summaryModules?.financialData ?? null;
  const recommendationTrend = summaryModules?.recommendationTrend ?? null;
  const calendarEvents = summaryModules?.calendarEvents ?? null;
  const upgradeDowngradeHistory = summaryModules?.upgradeDowngradeHistory ?? null;

  if (!quote && !earningsSummary) {
    return Response.json(
      {
        payload: encodePayload({
          error: `No fundamentals data found for ${symbolKey}. Symbol may be invalid or not supported.`,
        }),
      },
      { status: 404 }
    );
  }

  const profile = quote
    ? {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.symbol,
        exchange: quote.fullExchangeName || quote.exchange,
        exchangeCode: quote.exchange,
        currency: quote.currency,
        quoteType: quote.quoteType,
        marketState: quote.marketState,
        marketTime:
          quote.regularMarketTime?.fmt ||
          (quote.regularMarketTime != null ? toISOStr(quote.regularMarketTime) : null),
        sector: quote.sector || null,
        industry: quote.industry || null,
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
                  (quote.preMarketTime != null ? toISOStr(quote.preMarketTime) : null),
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
                  (quote.postMarketTime != null ? toISOStr(quote.postMarketTime) : null),
              }
            : null,
      }
    : null;

  const marketData = quote
    ? {
        quoteSourceName: quote.quoteSourceName ?? null,
        marketState: quote.marketState ?? null,
        exchangeTimezoneName: quote.exchangeTimezoneName ?? null,
        exchangeTimezoneShortName: quote.exchangeTimezoneShortName ?? null,
        regularMarketTime:
          quote.regularMarketTime?.fmt ||
          (quote.regularMarketTime != null ? toISOStr(quote.regularMarketTime) : null),
        preMarketTime:
          quote.preMarketTime?.fmt ||
          (quote.preMarketTime != null ? toISOStr(quote.preMarketTime) : null),
        postMarketTime:
          quote.postMarketTime?.fmt ||
          (quote.postMarketTime != null ? toISOStr(quote.postMarketTime) : null),
        hasPrePostMarketData: quote.hasPrePostMarketData ?? null,
        bid: toPlainValue(quote.bid),
        ask: toPlainValue(quote.ask),
        bidSize: toPlainValue(quote.bidSize),
        askSize: toPlainValue(quote.askSize),
        regularMarketVolume: toPlainValue(quote.regularMarketVolume),
        averageDailyVolume3Month: toPlainValue(quote.averageDailyVolume3Month),
        averageDailyVolume10Day: toPlainValue(quote.averageDailyVolume10Day),
        fiftyDayAverage: toPlainValue(quote.fiftyDayAverage),
        fiftyDayAverageChange: toPlainValue(quote.fiftyDayAverageChange),
        fiftyDayAverageChangePercent: toPlainValue(quote.fiftyDayAverageChangePercent),
        twoHundredDayAverage: toPlainValue(quote.twoHundredDayAverage),
        twoHundredDayAverageChange: toPlainValue(quote.twoHundredDayAverageChange),
        twoHundredDayAverageChangePercent: toPlainValue(quote.twoHundredDayAverageChangePercent),
        fiftyTwoWeekLow: toPlainValue(quote.fiftyTwoWeekLow),
        fiftyTwoWeekHigh: toPlainValue(quote.fiftyTwoWeekHigh),
        fiftyTwoWeekLowChange: toPlainValue(quote.fiftyTwoWeekLowChange),
        fiftyTwoWeekLowChangePercent: toPlainValue(quote.fiftyTwoWeekLowChangePercent),
        fiftyTwoWeekHighChange: toPlainValue(quote.fiftyTwoWeekHighChange),
        fiftyTwoWeekHighChangePercent: toPlainValue(quote.fiftyTwoWeekHighChangePercent),
        averageAnalystRating: quote.averageAnalystRating ?? null,
        earningsTimestamp:
          quote.earningsTimestamp?.fmt ||
          (quote.earningsTimestamp != null ? toISOStr(quote.earningsTimestamp) : null),
        earningsTimestampStart:
          quote.earningsTimestampStart?.fmt ||
          (quote.earningsTimestampStart != null ? toISOStr(quote.earningsTimestampStart) : null),
        earningsTimestampEnd:
          quote.earningsTimestampEnd?.fmt ||
          (quote.earningsTimestampEnd != null ? toISOStr(quote.earningsTimestampEnd) : null),
        earningsCallTimestampStart:
          quote.earningsCallTimestampStart?.fmt ||
          (quote.earningsCallTimestampStart != null ? toISOStr(quote.earningsCallTimestampStart) : null),
        earningsCallTimestampEnd:
          quote.earningsCallTimestampEnd?.fmt ||
          (quote.earningsCallTimestampEnd != null ? toISOStr(quote.earningsCallTimestampEnd) : null),
        isEarningsDateEstimate: quote.isEarningsDateEstimate ?? null,
      }
    : null;

  const valuations = quote
    ? {
        marketCap: toNumber(quote.marketCap),
        trailingPe: toNumber(quote.trailingPE),
        forwardPe: toNumber(quote.forwardPE),
        priceToBook: toNumber(quote.priceToBook),
        priceToSales: toNumber(quote.priceToSalesTrailing12Months),
        evToEbitda: toNumber(quote.enterpriseToEbitda),
        evToRevenue: toNumber(quote.enterpriseToRevenue),
        enterpriseValue: toNumber(quote.enterpriseValue),
        pegRatio: toNumber(quote.pegRatio),
      }
    : {};

  const earningsChart = earningsSummary?.earningsChart || {};
  const financialsChart = earningsSummary?.financialsChart || {};

  const simplifiedAssetProfile = assetProfile ? simplifyValue(assetProfile) : null;
  const simplifiedSummaryDetail = summaryDetail ? simplifyValue(summaryDetail) : null;
  const simplifiedKeyStatistics = defaultKeyStatistics ? simplifyValue(defaultKeyStatistics) : null;
  const simplifiedFinancialData = financialData ? simplifyValue(financialData) : null;

  const recommendations =
    recommendationTrend || financialData
      ? {
          trend: Array.isArray(recommendationTrend?.trend)
            ? recommendationTrend.trend.map((entry) => ({
                period: entry.period || null,
                strongBuy: entry.strongBuy ?? null,
                buy: entry.buy ?? null,
                hold: entry.hold ?? null,
                sell: entry.sell ?? null,
                strongSell: entry.strongSell ?? null,
              }))
            : [],
          details: simplifiedFinancialData
            ? {
                targetHighPrice: simplifiedFinancialData.targetHighPrice ?? null,
                targetLowPrice: simplifiedFinancialData.targetLowPrice ?? null,
                targetMeanPrice: simplifiedFinancialData.targetMeanPrice ?? null,
                targetMedianPrice: simplifiedFinancialData.targetMedianPrice ?? null,
                numberOfAnalystOpinions: simplifiedFinancialData.numberOfAnalystOpinions ?? null,
                recommendationMean: simplifiedFinancialData.recommendationMean ?? null,
                recommendationKey: simplifiedFinancialData.recommendationKey ?? null,
              }
            : null,
        }
      : null;

  const analysis = {
    earnings: {
      quarterly: mapEarningsSeries(earningsChart.quarterly),
      annual: mapEarningsSeries(earningsChart.annual),
    },
    revenue: {
      quarterly: mapFinancialsSeries(financialsChart.quarterly),
      annual: mapFinancialsSeries(financialsChart.yearly || financialsChart.annual),
    },
    currency: earningsSummary?.financialCurrency || profile?.currency || null,
  };

  // Calendar events (earnings dates, dividends, etc.)
  const calendarData = calendarEvents ? {
    earningsDate: calendarEvents.earnings?.earningsDate
      ? (Array.isArray(calendarEvents.earnings.earningsDate) 
          ? calendarEvents.earnings.earningsDate.map(d => d instanceof Date ? d.toISOString() : d)
          : [calendarEvents.earnings.earningsDate instanceof Date ? calendarEvents.earnings.earningsDate.toISOString() : calendarEvents.earnings.earningsDate])
      : [],
    exDividendDate: calendarEvents.exDividendDate instanceof Date 
      ? calendarEvents.exDividendDate.toISOString() 
      : calendarEvents.exDividendDate || null,
    dividendDate: calendarEvents.dividendDate instanceof Date 
      ? calendarEvents.dividendDate.toISOString() 
      : calendarEvents.dividendDate || null,
  } : null;

  // Upgrade/Downgrade History (most recent 10)
  const upgrades = upgradeDowngradeHistory?.history
    ? upgradeDowngradeHistory.history.slice(0, 10).map(entry => ({
        firm: entry.firm || null,
        toGrade: entry.toGrade || null,
        fromGrade: entry.fromGrade || null,
        action: entry.action || null,
        date: entry.epochGradeDate 
          ? new Date(entry.epochGradeDate * 1000).toISOString()
          : (entry.date instanceof Date ? entry.date.toISOString() : entry.date || null),
      }))
    : [];

  // Additional financial health metrics
  const financialHealth = simplifiedFinancialData ? {
    totalCash: simplifiedFinancialData.totalCash ?? null,
    totalCashPerShare: simplifiedFinancialData.totalCashPerShare ?? null,
    totalDebt: simplifiedFinancialData.totalDebt ?? null,
    debtToEquity: simplifiedFinancialData.debtToEquity ?? null,
    quickRatio: simplifiedFinancialData.quickRatio ?? null,
    currentRatio: simplifiedFinancialData.currentRatio ?? null,
    totalRevenue: simplifiedFinancialData.totalRevenue ?? null,
    revenuePerShare: simplifiedFinancialData.revenuePerShare ?? null,
    returnOnAssets: simplifiedFinancialData.returnOnAssets ?? null,
    returnOnEquity: simplifiedFinancialData.returnOnEquity ?? null,
    grossMargins: simplifiedFinancialData.grossMargins ?? null,
    ebitdaMargins: simplifiedFinancialData.ebitdaMargins ?? null,
    operatingMargins: simplifiedFinancialData.operatingMargins ?? null,
    profitMargins: simplifiedFinancialData.profitMargins ?? null,
    freeCashflow: simplifiedFinancialData.freeCashflow ?? null,
    operatingCashflow: simplifiedFinancialData.operatingCashflow ?? null,
    earningsGrowth: simplifiedFinancialData.earningsGrowth ?? null,
    revenueGrowth: simplifiedFinancialData.revenueGrowth ?? null,
  } : null;

  // Key statistics extras
  const keyStatsExtras = simplifiedKeyStatistics ? {
    beta: simplifiedKeyStatistics.beta ?? null,
    bookValue: simplifiedKeyStatistics.bookValue ?? null,
    trailingEps: simplifiedKeyStatistics.trailingEps ?? null,
    forwardEps: simplifiedKeyStatistics.forwardEps ?? null,
    earningsQuarterlyGrowth: simplifiedKeyStatistics.earningsQuarterlyGrowth ?? null,
    sharesOutstanding: simplifiedKeyStatistics.sharesOutstanding ?? null,
    floatShares: simplifiedKeyStatistics.floatShares ?? null,
    sharesShort: simplifiedKeyStatistics.sharesShort ?? null,
    sharesShortPriorMonth: simplifiedKeyStatistics.sharesShortPriorMonth ?? null,
    sharesShortPreviousMonthDate: simplifiedKeyStatistics.sharesShortPreviousMonthDate ?? null,
    sharesPercentSharesOut: simplifiedKeyStatistics.sharesPercentSharesOut ?? null,
    shortPercentOfFloat: simplifiedKeyStatistics.shortPercentOfFloat ?? null,
    shortRatio: simplifiedKeyStatistics.shortRatio ?? null,
    impliedSharesOutstanding: simplifiedKeyStatistics.impliedSharesOutstanding ?? null,
    heldPercentInsiders: simplifiedKeyStatistics.heldPercentInsiders ?? null,
    heldPercentInstitutions: simplifiedKeyStatistics.heldPercentInstitutions ?? null,
    lastSplitFactor: simplifiedKeyStatistics.lastSplitFactor ?? null,
    lastSplitDate: simplifiedKeyStatistics.lastSplitDate ?? null,
    lastFiscalYearEnd: simplifiedKeyStatistics.lastFiscalYearEnd ?? null,
    nextFiscalYearEnd: simplifiedKeyStatistics.nextFiscalYearEnd ?? null,
    mostRecentQuarter: simplifiedKeyStatistics.mostRecentQuarter ?? null,
    fiftyTwoWeekChange: simplifiedKeyStatistics['52WeekChange'] ?? null,
  } : null;

  const governance = simplifiedAssetProfile ? {
    auditRisk: simplifiedAssetProfile.auditRisk ?? null,
    boardRisk: simplifiedAssetProfile.boardRisk ?? null,
    compensationRisk: simplifiedAssetProfile.compensationRisk ?? null,
    shareHolderRightsRisk: simplifiedAssetProfile.shareHolderRightsRisk ?? null,
    overallRisk: simplifiedAssetProfile.overallRisk ?? null,
    governanceEpochDate: simplifiedAssetProfile.governanceEpochDate ?? null,
    compensationAsOfEpochDate: simplifiedAssetProfile.compensationAsOfEpochDate ?? null,
  } : null;

  // Dividend info from summaryDetail
  const dividendInfo = simplifiedSummaryDetail ? {
    dividendRate: simplifiedSummaryDetail.dividendRate ?? null,
    dividendYield: simplifiedSummaryDetail.dividendYield ?? null,
    exDividendDate: simplifiedSummaryDetail.exDividendDate ?? null,
    payoutRatio: simplifiedSummaryDetail.payoutRatio ?? null,
    fiveYearAvgDividendYield: simplifiedSummaryDetail.fiveYearAvgDividendYield ?? null,
    trailingAnnualDividendRate: simplifiedSummaryDetail.trailingAnnualDividendRate ?? null,
    trailingAnnualDividendYield: simplifiedSummaryDetail.trailingAnnualDividendYield ?? null,
  } : null;

  const responseData = {
    profile,
    price,
    valuations,
    analysis,
    assetProfile: simplifiedAssetProfile,
    summaryDetail: simplifiedSummaryDetail,
    keyStatistics: simplifiedKeyStatistics,
    financialData: simplifiedFinancialData,
    recommendations,
    calendarData,
    upgrades,
    marketData,
    governance,
    financialHealth,
    keyStatsExtras,
    dividendInfo,
    source: { provider: 'yahoo-finance2' },
  };

  setCachedFundamentals(symbolKey, responseData);

  return Response.json({
    payload: encodePayload(responseData),
  });
}
