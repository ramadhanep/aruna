/**
 * Seasonal data calculation utilities
 * Ported from Python core/data.py
 */

/**
 * Remove incomplete years from dataset (< min_days)
 */
export function removeIncompleteYears(data, minDays = 200) {
  const yearCounts = {};
  
  data.forEach(row => {
    const year = row.year;
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });

  const validYears = Object.keys(yearCounts).filter(
    year => yearCounts[year] >= minDays
  );

  return data.filter(row => validYears.includes(String(row.year)));
}

/**
 * Compute daily returns and add year/day_of_year columns
 */
export function computeDailyReturns(data) {
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Track last close per year to correctly compute within-year daily returns
  const lastCloseByYear = {};

  return sorted.map(row => {
    const date = new Date(row.date);
    const year = date.getFullYear();
    const dayOfYear = getDayOfYear(date);

    const prevClose = lastCloseByYear[year];
    let dailyReturn = 0;
    if (prevClose != null && row.adjclose != null) {
      dailyReturn = row.adjclose / prevClose - 1;
    }
    // update tracker AFTER computing return
    if (row.adjclose != null) {
      lastCloseByYear[year] = row.adjclose;
    }

    return { ...row, year, dayOfYear, dailyReturn };
  });
}

/**
 * Get day of year (1-366)
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get election cycle label for a given year
 */
export function getElectionCycleLabel(year) {
  const cyc = year % 4;
  if (cyc === 0) return 'Election Year';
  if (cyc === 1) return 'Post-Election Year';
  if (cyc === 2) return 'Mid-Term Year';
  return 'Pre-Election Year';
}

/**
 * Hirsch-style seasonal pattern: average daily returns across years
 */
export function hirschStyleSeasonalPattern(data) {
  // Group by day_of_year
  const grouped = {};
  
  data.forEach(row => {
    const doy = row.dayOfYear;
    if (!grouped[doy]) {
      grouped[doy] = [];
    }
    grouped[doy].push(row.dailyReturn);
  });

  // Compute average daily return for each day
  const result = Object.keys(grouped)
    .map(doy => {
      const returns = grouped[doy];
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      return { dayOfYear: parseInt(doy), avgDailyReturn: avgReturn };
    })
    .sort((a, b) => a.dayOfYear - b.dayOfYear);

  // Compute cumulative factor and pct_change_ytd
  let cumulativeFactor = 1.0;
  return result.map(row => {
    cumulativeFactor *= 1 + row.avgDailyReturn;
    const pctChangeYtd = (cumulativeFactor - 1.0) * 100.0;
    return {
      dayOfYear: row.dayOfYear,
      pctChangeYtd,
      cumulativeFactor,
    };
  });
}

/**
 * Compute single year pattern (current year)
 */
export function computeSingleYearPattern(data, singleYear) {
  const filtered = data.filter(row => row.year === singleYear);
  const sorted = [...filtered].sort((a, b) => a.dayOfYear - b.dayOfYear);

  let cumulativeFactor = 1.0;
  return sorted.map(row => {
    cumulativeFactor *= 1 + row.dailyReturn;
    const pctChangeYtd = (cumulativeFactor - 1.0) * 100.0;
    return {
      dayOfYear: row.dayOfYear,
      pctChangeYtd,
      cumulativeFactor,
    };
  });
}

/**
 * Convert day of year to month/date string (for x-axis labels)
 */
export function dayOfYearToMonthDate(dayOfYear) {
  const date = new Date(2000, 0, 1);
  date.setDate(date.getDate() + dayOfYear - 1);
  return date;
}

/**
 * Forward-fill missing days in a single-year pattern to create an unbroken line.
 * Assumes input sorted ascending by dayOfYear.
 */
export function forwardFillSingleYear(pattern) {
  if (!pattern || pattern.length === 0) return [];
  const filled = [];
  let prev = null;
  for (let i = 0; i < pattern.length; i++) {
    const point = pattern[i];
    if (prev) {
      // Fill gaps between prev.dayOfYear and current point
      for (let d = prev.dayOfYear + 1; d < point.dayOfYear; d++) {
        filled.push({
          dayOfYear: d,
          pctChangeYtd: prev.pctChangeYtd,
          cumulativeFactor: prev.cumulativeFactor,
          _filled: true,
        });
      }
    }
    filled.push(point);
    prev = point;
  }
  return filled;
}

/**
 * Calculate monthly returns for heatmap
 * Returns array of { year, month, return } for all available data
 */
export function calculateMonthlyReturns(data) {
  // Group data by year and month
  const grouped = {};
  
  data.forEach(row => {
    const date = new Date(row.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const key = `${year}-${month}`;
    
    if (!grouped[key]) {
      grouped[key] = { year, month, prices: [] };
    }
    grouped[key].prices.push({ date: row.date, price: row.adjclose });
  });

  // Calculate returns for each month
  const monthlyReturns = [];
  Object.values(grouped).forEach(group => {
    const sorted = group.prices.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length > 0) {
      const firstPrice = sorted[0].price;
      const lastPrice = sorted[sorted.length - 1].price;
      const returnPct = ((lastPrice - firstPrice) / firstPrice) * 100;
      monthlyReturns.push({
        year: group.year,
        month: group.month,
        return: returnPct,
      });
    }
  });

  return monthlyReturns;
}

/**
 * Calculate quarterly returns for heatmap
 * Returns array of { year, quarter, return } for all available data
 */
export function calculateQuarterlyReturns(data) {
  // Group data by year and quarter
  const grouped = {};
  
  data.forEach(row => {
    const date = new Date(row.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3); // 1-4
    const key = `${year}-Q${quarter}`;
    
    if (!grouped[key]) {
      grouped[key] = { year, quarter, prices: [] };
    }
    grouped[key].prices.push({ date: row.date, price: row.adjclose });
  });

  // Calculate returns for each quarter
  const quarterlyReturns = [];
  Object.values(grouped).forEach(group => {
    const sorted = group.prices.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length > 0) {
      const firstPrice = sorted[0].price;
      const lastPrice = sorted[sorted.length - 1].price;
      const returnPct = ((lastPrice - firstPrice) / firstPrice) * 100;
      quarterlyReturns.push({
        year: group.year,
        quarter: group.quarter,
        return: returnPct,
      });
    }
  });

  return quarterlyReturns;
}

/**
 * Format monthly returns data for heatmap display
 * Returns last N years + average row
 */
export function formatMonthlyHeatmap(monthlyReturns, maxYears = 10) {
  if (!monthlyReturns || monthlyReturns.length === 0) return { rows: [], average: {}, winRate: {} };

  // Get unique years and sort descending
  const years = [...new Set(monthlyReturns.map(r => r.year))].sort((a, b) => b - a);
  const recentYears = years.slice(0, maxYears);

  // Compound the monthly returns available for a given year into a full-year total
  const computeYearTotal = (year) => {
    let compounded = 1;
    let hasValue = false;
    for (let month = 1; month <= 12; month++) {
      const found = monthlyReturns.find(r => r.year === year && r.month === month);
      if (found && found.return !== null && found.return !== undefined) {
        compounded *= (1 + found.return / 100);
        hasValue = true;
      }
    }
    return hasValue ? (compounded - 1) * 100 : null;
  };

  // Build matrix for recent years
  const rows = recentYears.map(year => {
    const row = { year };
    for (let month = 1; month <= 12; month++) {
      const found = monthlyReturns.find(r => r.year === year && r.month === month);
      row[`M${month}`] = found ? found.return : null;
    }
    row.Total = computeYearTotal(year);
    return row;
  });

  // Calculate average and winning probability across ALL years (not just recent)
  const average = { year: 'Average' };
  const winRate = { year: 'Probability' };
  for (let month = 1; month <= 12; month++) {
    const values = monthlyReturns.filter(r => r.month === month && r.return !== null).map(r => r.return);
    average[`M${month}`] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    winRate[`M${month}`] = values.length > 0 ? (values.filter(v => v > 0).length / values.length) * 100 : null;
  }

  const yearTotals = years.map(computeYearTotal).filter(v => v !== null);
  average.Total = yearTotals.length > 0 ? yearTotals.reduce((a, b) => a + b, 0) / yearTotals.length : null;
  winRate.Total = yearTotals.length > 0 ? (yearTotals.filter(v => v > 0).length / yearTotals.length) * 100 : null;

  return { rows, average, winRate };
}

/**
 * Format quarterly returns data for heatmap display
 * Returns last N years + average row
 */
export function formatQuarterlyHeatmap(quarterlyReturns, maxYears = 10) {
  if (!quarterlyReturns || quarterlyReturns.length === 0) return { rows: [], average: {}, winRate: {} };

  // Get unique years and sort descending
  const years = [...new Set(quarterlyReturns.map(r => r.year))].sort((a, b) => b - a);
  const recentYears = years.slice(0, maxYears);

  // Compound the quarterly returns available for a given year into a full-year total
  const computeYearTotal = (year) => {
    let compounded = 1;
    let hasValue = false;
    for (let quarter = 1; quarter <= 4; quarter++) {
      const found = quarterlyReturns.find(r => r.year === year && r.quarter === quarter);
      if (found && found.return !== null && found.return !== undefined) {
        compounded *= (1 + found.return / 100);
        hasValue = true;
      }
    }
    return hasValue ? (compounded - 1) * 100 : null;
  };

  // Build matrix for recent years
  const rows = recentYears.map(year => {
    const row = { year };
    for (let quarter = 1; quarter <= 4; quarter++) {
      const found = quarterlyReturns.find(r => r.year === year && r.quarter === quarter);
      row[`Q${quarter}`] = found ? found.return : null;
    }
    row.Total = computeYearTotal(year);
    return row;
  });

  // Calculate average and winning probability across ALL years (not just recent)
  const average = { year: 'Average' };
  const winRate = { year: 'Probability' };
  for (let quarter = 1; quarter <= 4; quarter++) {
    const values = quarterlyReturns.filter(r => r.quarter === quarter && r.return !== null).map(r => r.return);
    average[`Q${quarter}`] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    winRate[`Q${quarter}`] = values.length > 0 ? (values.filter(v => v > 0).length / values.length) * 100 : null;
  }

  const yearTotals = years.map(computeYearTotal).filter(v => v !== null);
  average.Total = yearTotals.length > 0 ? yearTotals.reduce((a, b) => a + b, 0) / yearTotals.length : null;
  winRate.Total = yearTotals.length > 0 ? (yearTotals.filter(v => v > 0).length / yearTotals.length) * 100 : null;

  return { rows, average, winRate };
}

/**
 * Diverging heatmap color for a winning-probability percentage (0-100),
 * centered at 50%. Mirrors the intensity-scaled rgba() approach used for
 * return-magnitude heatmaps, but keyed off distance from 50 instead of 0.
 */
export function getWinRateCellStyle(pct) {
  if (pct == null || isNaN(pct)) return {};
  const clamped = Math.max(0, Math.min(100, pct));
  const diff = clamped - 50;
  const intensity = Math.abs(diff) / 50;
  const alpha = 0.12 + intensity * 0.68;

  if (diff > 0) {
    return {
      backgroundColor: `rgba(34, 197, 94, ${alpha.toFixed(2)})`,
      color: intensity > 0.35 ? '#ffffff' : undefined,
    };
  }
  if (diff < 0) {
    return {
      backgroundColor: `rgba(239, 68, 68, ${alpha.toFixed(2)})`,
      color: intensity > 0.35 ? '#ffffff' : undefined,
    };
  }
  return { backgroundColor: 'rgba(148, 163, 184, 0.15)' };
}
