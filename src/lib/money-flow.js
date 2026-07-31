import { getIdxLogoUrl } from "@/lib/supabase-storage";

const STOCKBIT_BASE_URL = "https://exodus.stockbit.com";

export const MONEY_FLOW_TIMEFRAMES = {
  weekly: { label: "Weekly", days: 7 },
  monthly: { label: "Monthly", days: 30 },
  quarterly: { label: "Quarterly", days: 90 },
};

export const MONEY_FLOW_SORT_FIELDS = {
  score: "money_flow_score",
  volume_spike: "volume_spike",
  price_change: "price_change_1m",
};

const ACC_DIST_SCORE_MAP = {
  "big acc": 100,
  acc: 80,
  "small acc": 60,
  neutral: 50,
  "small dist": 40,
  dist: 20,
  "big dist": 0,
};

const SCORE_WEIGHTS = {
  broker: 0.3,
  top3: 0.2,
  volumeSpike: 0.15,
  momentum: 0.15,
  buyerSeller: 0.1,
  liquidity: 0.1,
};

const SCREENER_FIELD_MAP = {
  price: "price",
  "price ma 20": "price_ma_20",
  volume: "volume",
  "previous volume": "previous_volume",
  "bandar value": "bandar_value",
  "previous bandar value": "previous_bandar_value",
  value: "value",
};

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function buildStockbitHeaders(bearerToken) {
  return {
    Authorization: `Bearer ${bearerToken}`,
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json",
    Origin: "https://stockbit.com",
    Referer: "https://stockbit.com/",
  };
}

export function getStockbitDateRange(daysBack) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);

  const formatDate = (date) => date.toISOString().split("T")[0];
  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

export function buildMarketDetectorUrl(symbol, from, to, transactionType) {
  const params = new URLSearchParams({
    from,
    to,
    transaction_type: transactionType,
    market_board: "MARKET_BOARD_REGULER",
    investor_type: "INVESTOR_TYPE_ALL",
    limit: "25",
  });

  return `${STOCKBIT_BASE_URL}/marketdetectors/${symbol}?${params.toString()}`;
}

export function buildChartUrl(symbol) {
  return `${STOCKBIT_BASE_URL}/charts/${symbol}/daily?timeframe=3m`;
}

export function buildScreenerTemplateUrl(templateId, page = 1) {
  const params = new URLSearchParams({ type: "TEMPLATE_TYPE_CUSTOM", page: String(page) });
  return `${STOCKBIT_BASE_URL}/screener/templates/${templateId}?${params.toString()}`;
}

function normalizeScreenerItemName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toScreenerField(itemName) {
  const normalizedName = normalizeScreenerItemName(itemName);
  return SCREENER_FIELD_MAP[normalizedName] || normalizedName.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function computeScreenerDerivedMetrics(snapshot) {
  const volume = toNumber(snapshot.volume, 0);
  const previousVolume = toNumber(snapshot.previous_volume, 0);
  const price = toNumber(snapshot.price, 0);
  const priceMA20 = toNumber(snapshot.price_ma_20, 0);
  const bandarValue = toNumber(snapshot.bandar_value, 0);
  const previousBandarValue = toNumber(snapshot.previous_bandar_value, 0);

  return {
    volume_ratio: previousVolume > 0 ? Number((volume / previousVolume).toFixed(4)) : 0,
    price_vs_ma20_pct: priceMA20 > 0 ? Number((((price - priceMA20) / priceMA20) * 100).toFixed(4)) : 0,
    bandar_delta: Number((bandarValue - previousBandarValue).toFixed(2)),
  };
}

export function parseScreenerTemplatePayload(payload) {
  const calcs = payload?.data?.calcs;
  if (!Array.isArray(calcs)) {
    return {
      symbols: [],
      snapshots: {},
      metadata: {
        screener_id: null,
        screen_name: "",
        total_rows: 0,
        current_page: 1,
        per_page: 0,
      },
    };
  }

  const snapshots = {};

  for (const calc of calcs) {
    const symbol = String(calc?.company?.symbol || "").toUpperCase().trim();
    if (!symbol) {
      continue;
    }

    const snapshot = {
      symbol,
      company_name: calc?.company?.name || symbol,
      icon_url: getIdxLogoUrl(symbol) || calc?.company?.icon_url || "",
    };

    const results = Array.isArray(calc?.results) ? calc.results : [];
    for (const row of results) {
      const field = toScreenerField(row?.item);
      snapshot[field] = toNumber(row?.raw, 0);
      snapshot[`${field}_display`] = row?.display ?? "";
    }

    snapshot.derived = computeScreenerDerivedMetrics(snapshot);
    snapshots[symbol] = snapshot;
  }

  const metadata = {
    screener_id: toNumber(payload?.data?.screenerid, 0),
    screen_name: payload?.data?.screen_name || "",
    total_rows: toNumber(payload?.data?.totalrows, calcs.length),
    current_page: toNumber(payload?.data?.curpage, 1),
    per_page: toNumber(payload?.data?.perpage, calcs.length),
    type: payload?.data?.type || "",
    sort: payload?.data?.sort || "",
  };

  return {
    symbols: Object.keys(snapshots),
    snapshots,
    metadata,
  };
}

function getChartPrices(chartData) {
  const prices = chartData?.data?.prices || chartData?.prices;
  if (!Array.isArray(prices)) {
    return [];
  }

  return prices
    .map((row) => ({
      date: row.formatted_date || row.date,
      dateNum: toNumber(row.date, 0),
      close: toNumber(row.value, 0),
      volume: toNumber(row.volume, 0),
      percentage: toNumber(row.percentage, 0),
      change: toNumber(row.change, 0),
    }))
    .filter((row) => row.close > 0)
    .sort((a, b) => {
      if (a.dateNum && b.dateNum) {
        return a.dateNum - b.dateNum;
      }
      return String(a.date).localeCompare(String(b.date));
    });
}

export function processPriceData(chartData) {
  const prices = getChartPrices(chartData);

  if (!prices.length) {
    return {
      current: 0,
      change_5d: 0,
      change_10d: 0,
      change_20d: 0,
      range_10d: 0,
      price_1m_ago: 0,
      price_change_1m: 0,
      history: [],
    };
  }

  const current = prices[prices.length - 1].close;
  const pctChange = (dayOffset) => {
    const index = prices.length - 1 - dayOffset;
    if (index < 0) return 0;

    const reference = prices[index]?.close;
    if (!reference) return 0;

    return Number((((current - reference) / reference) * 100).toFixed(2));
  };

  const last10 = prices.slice(-10);
  const max10 = Math.max(...last10.map((item) => item.close));
  const min10 = Math.min(...last10.map((item) => item.close));

  const referenceIndex1m = Math.max(0, prices.length - 21);
  const price1mAgo = prices[referenceIndex1m]?.close || 0;
  const priceChange1m = price1mAgo > 0 ? Number((((current - price1mAgo) / price1mAgo)).toFixed(6)) : 0;

  return {
    current,
    change_5d: pctChange(5),
    change_10d: pctChange(10),
    change_20d: pctChange(20),
    change_3m: pctChange(60),
    range_10d: current > 0 ? Number((((max10 - min10) / current) * 100).toFixed(2)) : 0,
    price_1m_ago: price1mAgo,
    price_change_1m: priceChange1m,
    history: prices.slice(-30),
  };
}

export function calculateVolumeSpike(chartData, bandarDetector = {}, screenerSnapshot = null) {
  const prices = getChartPrices(chartData);
  const volumes = prices.map((row) => row.volume).filter((volume) => volume > 0);

  if (volumes.length >= 20) {
    const latestVolume = volumes[volumes.length - 1];
    const recent20 = volumes.slice(-20);
    const avgVolume20 = recent20.reduce((sum, volume) => sum + volume, 0) / recent20.length;

    if (avgVolume20 > 0) {
      return {
        volume_spike: latestVolume / avgVolume20,
        today_volume: latestVolume,
        avg_volume_20: avgVolume20,
      };
    }
  }

  const screenerVolume = toNumber(screenerSnapshot?.volume, 0);
  const screenerPreviousVolume = toNumber(screenerSnapshot?.previous_volume, 0);
  if (screenerVolume > 0 && screenerPreviousVolume > 0) {
    return {
      volume_spike: screenerVolume / screenerPreviousVolume,
      today_volume: screenerVolume,
      avg_volume_20: screenerPreviousVolume,
    };
  }

  const detectorVolume = toNumber(bandarDetector.volume, 0);
  const detectorAverageVolume = toNumber(bandarDetector?.avg?.vol, 0);

  if (detectorVolume > 0 && detectorAverageVolume > 0) {
    return {
      volume_spike: detectorVolume / detectorAverageVolume,
      today_volume: detectorVolume,
      avg_volume_20: detectorAverageVolume,
    };
  }

  return {
    volume_spike: 0,
    today_volume: detectorVolume,
    avg_volume_20: detectorAverageVolume,
  };
}

function normalizeBrokerAccdist(accdistLabel) {
  const normalized = String(accdistLabel || "neutral").trim().toLowerCase();
  return ACC_DIST_SCORE_MAP[normalized] ?? 50;
}

function normalizeTop3Percent(top3Percent) {
  return clamp((toNumber(top3Percent, 0) / 20) * 100, 0, 100);
}

function normalizeVolumeSpike(volumeSpike) {
  return clamp((toNumber(volumeSpike, 0) / 4) * 100, 0, 100);
}

function normalizeMomentum(priceChange1m) {
  const percentage = toNumber(priceChange1m, 0) * 100;
  return clamp(((percentage + 15) / 40) * 100, 0, 100);
}

function normalizeBuyerSeller(totalBuyer, totalSeller) {
  const buyers = toNumber(totalBuyer, 0);
  const sellers = toNumber(totalSeller, 0);
  const participants = buyers + sellers;

  if (participants <= 0) {
    return 50;
  }

  return clamp((buyers / participants) * 100, 0, 100);
}

function normalizeLiquidity(value) {
  const rawValue = toNumber(value, 0);
  if (rawValue <= 0) {
    return 0;
  }

  const minLog = 10;
  const maxLog = 13;
  const scaled = ((Math.log10(rawValue) - minLog) / (maxLog - minLog)) * 100;
  return clamp(scaled, 0, 100);
}

export function calculateMoneyFlowScore({
  broker_accdist,
  top3_percent,
  volume_spike,
  price_change_1m,
  total_buyer,
  total_seller,
  value,
}) {
  const brokerComponent = normalizeBrokerAccdist(broker_accdist);
  const top3Component = normalizeTop3Percent(top3_percent);
  const volumeSpikeComponent = normalizeVolumeSpike(volume_spike);
  const momentumComponent = normalizeMomentum(price_change_1m);
  const buyerSellerComponent = normalizeBuyerSeller(total_buyer, total_seller);
  const liquidityComponent = normalizeLiquidity(value);

  const weightedScore =
    brokerComponent * SCORE_WEIGHTS.broker +
    top3Component * SCORE_WEIGHTS.top3 +
    volumeSpikeComponent * SCORE_WEIGHTS.volumeSpike +
    momentumComponent * SCORE_WEIGHTS.momentum +
    buyerSellerComponent * SCORE_WEIGHTS.buyerSeller +
    liquidityComponent * SCORE_WEIGHTS.liquidity;

  return {
    score: Number(weightedScore.toFixed(2)),
    breakdown: {
      broker_accumulation: Number(brokerComponent.toFixed(2)),
      top3_percent: Number(top3Component.toFixed(2)),
      volume_spike: Number(volumeSpikeComponent.toFixed(2)),
      price_momentum: Number(momentumComponent.toFixed(2)),
      buyer_vs_seller: Number(buyerSellerComponent.toFixed(2)),
      liquidity: Number(liquidityComponent.toFixed(2)),
    },
  };
}

export function classifySignal(score) {
  const normalizedScore = toNumber(score, 0);

  if (normalizedScore >= 80) {
    return "Strong Accumulation";
  }
  if (normalizedScore >= 60) {
    return "Accumulation";
  }
  if (normalizedScore >= 40) {
    return "Neutral";
  }
  return "Distribution";
}

export function normalizeBrokerSummary(netData, grossData) {
  const brokerSummaryNet = netData?.data?.broker_summary || {};
  const brokerSummaryGross = grossData?.data?.broker_summary || {};
  const brokerMap = new Map();

  const ensureBroker = (code) => {
    const normalizedCode = String(code || "-").trim().toUpperCase();
    if (!brokerMap.has(normalizedCode)) {
      brokerMap.set(normalizedCode, {
        broker_code: normalizedCode,
        buy_value: 0,
        sell_value: 0,
        buy_volume: 0,
        sell_volume: 0,
        avg_buy_price: 0,
        avg_sell_price: 0,
        gross_buy: 0,
        gross_sell: 0,
      });
    }

    return brokerMap.get(normalizedCode);
  };

  const buys = brokerSummaryNet.brokers_buy || [];
  for (const broker of buys) {
    const row = ensureBroker(broker.netbs_broker_code || broker.code);
    row.buy_value = toNumber(broker.bval, 0);
    row.buy_volume = toNumber(broker.blot, 0) * 100;
    row.avg_buy_price = toNumber(broker.netbs_buy_avg_price, 0);
  }

  const sells = brokerSummaryNet.brokers_sell || [];
  for (const broker of sells) {
    const row = ensureBroker(broker.netbs_broker_code || broker.code);
    row.sell_value = Math.abs(toNumber(broker.sval, 0));
    row.sell_volume = Math.abs(toNumber(broker.slot, 0)) * 100;
    row.avg_sell_price = toNumber(broker.netbs_sell_avg_price, 0);
  }

  const grossBuys = brokerSummaryGross.brokers_buy || [];
  for (const broker of grossBuys) {
    const row = ensureBroker(broker.netbs_broker_code || broker.code);
    row.gross_buy = toNumber(broker.bval, 0);
  }

  const grossSells = brokerSummaryGross.brokers_sell || [];
  for (const broker of grossSells) {
    const row = ensureBroker(broker.netbs_broker_code || broker.code);
    row.gross_sell = Math.abs(toNumber(broker.sval, 0));
  }

  return Array.from(brokerMap.values())
    .map((row) => ({
      ...row,
      net_value: Number((row.buy_value - row.sell_value).toFixed(2)),
    }))
    .sort((a, b) => b.net_value - a.net_value);
}

export function processGrossTotals(grossData) {
  const summary = grossData?.data?.broker_summary || {};
  const totalBuy = (summary.brokers_buy || []).reduce((sum, item) => sum + toNumber(item.bval, 0), 0);
  const totalSell = (summary.brokers_sell || []).reduce((sum, item) => sum + Math.abs(toNumber(item.sval, 0)), 0);

  return {
    totalBuy: Number(totalBuy.toFixed(2)),
    totalSell: Number(totalSell.toFixed(2)),
  };
}

function analyzeBrokerInventory(brokerSummary) {
  return brokerSummary
    .filter((broker) => broker.net_value > 0)
    .slice(0, 10)
    .map((broker) => ({
      broker: broker.broker_code,
      position: Number(broker.net_value.toFixed(2)),
    }));
}

function analyzeBrokerCost(brokerSummary, currentPrice) {
  const totalBuyValue = brokerSummary.reduce((sum, broker) => sum + toNumber(broker.buy_value, 0), 0);
  const totalBuyVolume = brokerSummary.reduce((sum, broker) => sum + toNumber(broker.buy_volume, 0), 0);

  const estimatedCost = totalBuyVolume > 0 ? Math.round(totalBuyValue / totalBuyVolume) : 0;
  const distance = estimatedCost > 0 ? Number((((currentPrice - estimatedCost) / estimatedCost) * 100).toFixed(2)) : 0;

  let interpretation = "Unknown";
  if (distance < 10) interpretation = "Early accumulation";
  else if (distance <= 25) interpretation = "Markup phase";
  else interpretation = "Distribution risk";

  return {
    estimated_cost: estimatedCost,
    current_price: Number(toNumber(currentPrice, 0).toFixed(2)),
    distance_from_cost: `${distance}%`,
    distance_raw: distance,
    interpretation,
  };
}

function analyzeBrokerConcentration(brokerSummary) {
  const totalBuy = brokerSummary.reduce((sum, broker) => sum + toNumber(broker.buy_value, 0), 0);
  const top3Buy = [...brokerSummary]
    .sort((a, b) => toNumber(b.buy_value, 0) - toNumber(a.buy_value, 0))
    .slice(0, 3)
    .reduce((sum, broker) => sum + toNumber(broker.buy_value, 0), 0);

  const pct = totalBuy > 0 ? Number(((top3Buy / totalBuy) * 100).toFixed(1)) : 0;

  let interpretation = "Retail dominated";
  if (pct > 50) interpretation = "Strong smart money control";
  else if (pct >= 30) interpretation = "Moderate";

  return {
    top3_buy_percent: pct,
    interpretation,
  };
}

function analyzeAbsorption(brokerSummary, grossTotals) {
  const topBrokerBuy = [...brokerSummary]
    .sort((a, b) => toNumber(b.buy_value, 0) - toNumber(a.buy_value, 0))
    .slice(0, 3)
    .reduce((sum, broker) => sum + toNumber(broker.buy_value, 0), 0);

  const totalSell = toNumber(grossTotals?.totalSell, 0) || 1;
  const absorption = Number(((topBrokerBuy / totalSell) * 100).toFixed(1));

  let interpretation = "Weak";
  if (absorption > 40) interpretation = "Strong absorption";
  else if (absorption >= 20) interpretation = "Moderate";

  return {
    value: absorption,
    interpretation,
  };
}

function analyzeAccumulationPersistence(detector, brokerSummary) {
  const top3Pct = toNumber(detector?.top3?.percent, 0);
  const positiveBrokers = brokerSummary.filter((broker) => broker.net_value > 0).length;

  let interpretation = "Weak persistence";
  if (top3Pct >= 12 && positiveBrokers >= 5) interpretation = "Strong accumulation persistence";
  else if (top3Pct >= 8 && positiveBrokers >= 3) interpretation = "Moderate persistence";

  return {
    proxy_days: null,
    positive_brokers: positiveBrokers,
    interpretation,
    note: "Daily broker persistence unavailable from marketdetectors endpoint; using proxy metrics.",
  };
}

function analyzeManipulationRisk(priceData, brokerSummary) {
  const priceRising = toNumber(priceData?.change_5d, 0) > 0;
  const totalNetSell = brokerSummary.reduce(
    (sum, broker) => sum + (broker.net_value < 0 ? Math.abs(toNumber(broker.net_value, 0)) : 0),
    0
  );
  const totalNetBuy = brokerSummary.reduce(
    (sum, broker) => sum + (broker.net_value > 0 ? toNumber(broker.net_value, 0) : 0),
    0
  );
  const totalVolume = brokerSummary.reduce(
    (sum, broker) => sum + toNumber(broker.buy_volume, 0) + toNumber(broker.sell_volume, 0),
    0
  );

  let risk = "LOW";
  const reasons = [];

  if (priceRising && totalNetSell > totalNetBuy) {
    risk = "HIGH";
    reasons.push("Price rising but net selling exceeds net buying");
  }

  if (totalNetBuy > 0 && totalVolume > 0) {
    const avgBuyPrice = toNumber(brokerSummary[0]?.avg_buy_price, 1);
    const impliedVolume = totalNetBuy / Math.max(avgBuyPrice, 1);

    if (impliedVolume > totalVolume * 0.5) {
      risk = risk === "HIGH" ? "CRITICAL" : "MEDIUM";
      reasons.push("Large net buy but relatively low volume");
    }
  }

  return {
    level: risk,
    reasons,
  };
}

function detectMarketPhase(priceData, brokerSummary) {
  const priceSideways = Math.abs(toNumber(priceData?.change_10d, 0)) < 5;
  const priceBreakout = toNumber(priceData?.change_5d, 0) > 5;
  const priceRising = toNumber(priceData?.change_10d, 0) > 0;

  const totalNetBuy = brokerSummary.reduce(
    (sum, broker) => sum + (broker.net_value > 0 ? toNumber(broker.net_value, 0) : 0),
    0
  );
  const totalNetSell = brokerSummary.reduce(
    (sum, broker) => sum + (broker.net_value < 0 ? Math.abs(toNumber(broker.net_value, 0)) : 0),
    0
  );

  const brokersBuying = totalNetBuy > totalNetSell;
  const brokersSelling = totalNetSell > totalNetBuy;

  if (priceSideways && brokersBuying) return "Accumulation";
  if (priceBreakout && brokersBuying) return "Markup";
  if (priceRising && brokersSelling) return "Distribution";
  if (priceSideways && brokersSelling) return "Distribution (Early)";
  if (priceBreakout && brokersSelling) return "Distribution (Late)";
  if (!priceRising && brokersBuying) return "Accumulation → Early Markup";

  return "Indeterminate";
}

function generateSummary(result) {
  const lines = [];

  if (String(result.market_phase || "").includes("Accumulation")) {
    lines.push("Smart money accumulation detected.");
  } else if (String(result.market_phase || "").includes("Markup")) {
    lines.push("Stock is in markup phase, with brokers still supporting upside movement.");
  } else if (String(result.market_phase || "").includes("Distribution")) {
    lines.push("Distribution phase detected, indicating potential smart-money exit behavior.");
  } else {
    lines.push(`Market phase: ${result.market_phase}.`);
  }

  const top2 = (result.broker_inventory || []).slice(0, 2).map((item) => item.broker);
  if (top2.length) {
    const estimatedCost = toNumber(result?.broker_cost_analysis?.estimated_cost, 0).toLocaleString("id-ID");
    const currentPrice = toNumber(result?.broker_cost_analysis?.current_price, 0).toLocaleString("id-ID");
    lines.push(`Top brokers ${top2.join(" and ")} accumulated near cost ${estimatedCost} while current price is ${currentPrice}.`);
  }

  const absorption = toNumber(result?.absorption_strength?.value, 0);
  if (absorption > 40) {
    lines.push("Absorption strength is high, suggesting supply is being absorbed effectively.");
  } else if (absorption >= 20) {
    lines.push("Absorption strength is moderate.");
  } else {
    lines.push("Absorption strength is weak and participation is still limited.");
  }

  if (result?.manipulation_risk?.level && result.manipulation_risk.level !== "LOW") {
    const reasons = Array.isArray(result?.manipulation_risk?.reasons)
      ? result.manipulation_risk.reasons.join("; ")
      : "irregular broker behavior detected";
    lines.push(`Manipulation risk is ${result.manipulation_risk.level}: ${reasons}.`);
  }

  const screener = result?.screener_snapshot;
  if (screener?.derived?.volume_ratio >= 1.25) {
    lines.push(`Screener confirms volume expansion (${screener.derived.volume_ratio.toFixed(2)}x vs previous day).`);
  }

  return lines.join("\n\n");
}

export function buildSmartMoneyAnalysis({ detector, priceData, brokerSummary, grossTotals, screenerSnapshot }) {
  const brokerInventory = analyzeBrokerInventory(brokerSummary);
  const brokerCost = analyzeBrokerCost(brokerSummary, priceData.current);
  const concentration = analyzeBrokerConcentration(brokerSummary);
  const absorption = analyzeAbsorption(brokerSummary, grossTotals);
  const persistence = analyzeAccumulationPersistence(detector, brokerSummary);
  const manipulationRisk = analyzeManipulationRisk(priceData, brokerSummary);
  const marketPhase = detectMarketPhase(priceData, brokerSummary);

  const result = {
    broker_inventory: brokerInventory,
    broker_cost_analysis: brokerCost,
    broker_concentration: concentration,
    absorption_strength: absorption,
    accumulation_persistence: persistence,
    market_phase: marketPhase,
    manipulation_risk: manipulationRisk,
    screener_snapshot: screenerSnapshot || null,
    summary: "",
  };

  result.summary = generateSummary(result);
  return result;
}

export function buildReasonLines(report) {
  const reasons = [];

  if (String(report.market_phase || "").includes("Accumulation")) {
    reasons.push(`Phase: ${report.market_phase}`);
  }

  const concentrationPct = toNumber(report?.broker_concentration?.top3_buy_percent, 0);
  if (concentrationPct >= 30) {
    reasons.push(`Top3 buy concentration ${concentrationPct.toFixed(1)}%`);
  }

  const absorptionValue = toNumber(report?.absorption_strength?.value, 0);
  if (absorptionValue >= 20) {
    reasons.push(`Absorption ${absorptionValue.toFixed(1)}%`);
  }

  if (toNumber(report.top3_percent, 0) >= 10) {
    reasons.push(`Top3 brokers bought ${toNumber(report.top3_percent, 0).toFixed(1)}% volume`);
  }

  if (toNumber(report.volume_spike, 0) >= 2) {
    reasons.push(`Volume spike ${toNumber(report.volume_spike, 0).toFixed(2)}x`);
  }

  if (reasons.length === 0) {
    reasons.push("Mixed smart-money and momentum signals");
  }

  return reasons.slice(0, 3);
}

export function buildMoneyFlowReport({
  symbol,
  netData,
  grossData,
  chartData,
  reportDate,
  screenerSnapshot = null,
  screenerId = null,
  screenerName = "",
}) {
  const detector = netData?.data?.bandar_detector || {};
  const top1Percent = toNumber(detector?.top1?.percent, 0);
  const top3Percent = toNumber(detector?.top3?.percent, 0);
  const top5Percent = toNumber(detector?.top5?.percent, 0);
  const totalBuyer = toNumber(detector?.total_buyer, 0);
  const totalSeller = toNumber(detector?.total_seller, 0);
  const totalValue = toNumber(detector?.value, 0);
  const totalVolume = toNumber(detector?.volume, 0);

  const priceData = processPriceData(chartData?.data || chartData);
  const { volume_spike, today_volume, avg_volume_20 } = calculateVolumeSpike(
    chartData,
    detector,
    screenerSnapshot
  );
  const scoreResult = calculateMoneyFlowScore({
    broker_accdist: detector?.broker_accdist,
    top3_percent: top3Percent,
    volume_spike,
    price_change_1m: priceData.price_change_1m,
    total_buyer: totalBuyer,
    total_seller: totalSeller,
    value: totalValue,
  });

  const signal = classifySignal(scoreResult.score);
  const brokerSummary = normalizeBrokerSummary(netData, grossData);
  const grossTotals = processGrossTotals(grossData);
  const smartMoney = buildSmartMoneyAnalysis({
    detector,
    priceData,
    brokerSummary,
    grossTotals,
    screenerSnapshot,
  });

  return {
    symbol,
    report_date: reportDate,
    money_flow_score: scoreResult.score,
    broker_accdist: detector?.broker_accdist || "Neutral",
    top1_percent: Number(top1Percent.toFixed(4)),
    top3_percent: Number(top3Percent.toFixed(4)),
    top5_percent: Number(top5Percent.toFixed(4)),
    total_buyer: totalBuyer,
    total_seller: totalSeller,
    value: Number(totalValue.toFixed(2)),
    volume: Number(totalVolume.toFixed(2)),
    volume_spike: Number(volume_spike.toFixed(4)),
    today_volume: Number(today_volume.toFixed(2)),
    avg_volume_20: Number(avg_volume_20.toFixed(2)),
    current_price: Number(toNumber(priceData.current, 0).toFixed(2)),
    price_1m_ago: Number(toNumber(priceData.price_1m_ago, 0).toFixed(2)),
    price_change_1m: Number(toNumber(priceData.price_change_1m, 0).toFixed(6)),
    price_change_5d: Number(toNumber(priceData.change_5d, 0).toFixed(2)),
    price_change_10d: Number(toNumber(priceData.change_10d, 0).toFixed(2)),
    price_change_20d: Number(toNumber(priceData.change_20d, 0).toFixed(2)),
    price_change_3m: Number(toNumber(priceData.change_3m, 0).toFixed(2)),
    price_range_10d: Number(toNumber(priceData.range_10d, 0).toFixed(2)),
    signal,
    score_breakdown: scoreResult.breakdown,
    broker_summary: brokerSummary,
    broker_inventory: smartMoney.broker_inventory,
    broker_cost_analysis: smartMoney.broker_cost_analysis,
    broker_concentration: smartMoney.broker_concentration,
    absorption_strength: smartMoney.absorption_strength,
    accumulation_persistence: smartMoney.accumulation_persistence,
    market_phase: smartMoney.market_phase,
    manipulation_risk: smartMoney.manipulation_risk,
    analysis_summary: smartMoney.summary,
    screener_id: screenerId,
    screener_name: screenerName,
    screener_snapshot: screenerSnapshot || null,
  };
}

export function buildTopPicks(reports, limit = 20) {
  const sorted = [...reports].sort((a, b) => toNumber(b.money_flow_score, 0) - toNumber(a.money_flow_score, 0));

  return sorted.slice(0, limit).map((report, index) => ({
    rank: index + 1,
    symbol: report.symbol,
    score: Number(toNumber(report.money_flow_score, 0).toFixed(2)),
    reason: buildReasonLines(report),
    price_change: Number(toNumber(report.price_change_1m, 0).toFixed(6)),
    volume_spike: Number(toNumber(report.volume_spike, 0).toFixed(4)),
    signal: report.signal || classifySignal(report.money_flow_score),
    market_phase: report.market_phase || "Indeterminate",
    absorption: Number(toNumber(report?.absorption_strength?.value, 0).toFixed(2)),
  }));
}

export function getTimeframeStartDate(timeframeKey, now = new Date()) {
  const timeframe = MONEY_FLOW_TIMEFRAMES[timeframeKey] || MONEY_FLOW_TIMEFRAMES.weekly;
  const start = new Date(now);
  start.setDate(start.getDate() - timeframe.days);
  return start;
}

export function getISODate(date = new Date()) {
  return new Date(date).toISOString().split("T")[0];
}

export function sortMoneyFlowReports(reports, sortBy = "score", sortOrder = "desc") {
  const field = MONEY_FLOW_SORT_FIELDS[sortBy] || MONEY_FLOW_SORT_FIELDS.score;
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...reports].sort((a, b) => {
    const left = toNumber(a[field], 0);
    const right = toNumber(b[field], 0);
    if (left === right) {
      return String(a.symbol || "").localeCompare(String(b.symbol || ""));
    }
    return (left - right) * direction;
  });
}

export function dedupeLatestBySymbol(reports) {
  const map = new Map();

  for (const report of reports) {
    const symbol = String(report.symbol || "").toUpperCase();
    if (!symbol) {
      continue;
    }

    const existing = map.get(symbol);
    if (!existing) {
      map.set(symbol, report);
      continue;
    }

    const existingDate = new Date(existing.report_date || 0).getTime();
    const currentDate = new Date(report.report_date || 0).getTime();

    if (currentDate > existingDate) {
      map.set(symbol, report);
    }
  }

  return Array.from(map.values());
}
