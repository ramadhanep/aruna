import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';

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
    return Response.json({ mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({ error: 'Missing symbol parameter' }) }, { status: 400 });
  }

  const symbolKey = symbol.trim().toUpperCase();

  let quote = null;
  try {
    quote = await yahooFinance.quote(symbolKey, {
      lang: 'en-US',
      region: 'US',
    });
  } catch (error) {
    console.warn(`Failed to fetch quote for ${symbolKey}`, error);
  }

  let summaryModules = null;
  try {
    summaryModules = await yahooFinance.quoteSummary(symbolKey, {
      modules: [
        'earnings',
        'assetProfile',
        'summaryDetail',
        'defaultKeyStatistics',
        'financialData',
        'recommendationTrend',
      ],
    });
  } catch (error) {
    console.warn(`Failed to fetch fundamentals summary for ${symbolKey}`, error);
  }

  const earningsSummary = summaryModules?.earnings ?? null;
  const assetProfile = summaryModules?.assetProfile ?? null;
  const summaryDetail = summaryModules?.summaryDetail ?? null;
  const defaultKeyStatistics = summaryModules?.defaultKeyStatistics ?? null;
  const financialData = summaryModules?.financialData ?? null;
  const recommendationTrend = summaryModules?.recommendationTrend ?? null;

  if (!quote && !earningsSummary) {
    return Response.json(
      {
        mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({
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
          (quote.regularMarketTime != null ? String(quote.regularMarketTime) : null),
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

  return Response.json({
    mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({
      profile,
      price,
      valuations,
      analysis,
      assetProfile: simplifiedAssetProfile,
      summaryDetail: simplifiedSummaryDetail,
      keyStatistics: simplifiedKeyStatistics,
      financialData: simplifiedFinancialData,
      recommendations,
      source: { provider: 'yahoo-finance2' },
    }),
  });
}
