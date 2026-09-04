import { formatPrice, formatPriceTrim } from '@/lib/utils';

export const formatTooltipDate = (dayOfYear) => {
  const date = new Date(2000, 0, 1);
  date.setDate(date.getDate() + dayOfYear - 1);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

export const formatNormalTimestamp = (timestamp, timeframe) => {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';
  if (timeframe === '15m') {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  if (['1h', '2h', '4h'].includes(timeframe)) {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
  }
  if (timeframe === 'M') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatPriceValue = (value, symbol) => formatPriceTrim(value, symbol, { fallback: '-' });

export const formatPlainNumber = (value) => {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return formatPrice(numeric, { locale: 'en-US', minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false });
  }
  return String(value);
};

export const formatDetailedCurrency = (value, fractionDigits) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};

export const formatQuantityValue = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
};

export const formatCompactCurrency = (value, formatter, currencyCode) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${formatter.format(Number(value))} ${currencyCode}`;
};

export const formatRatio = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
};

export const formatPercentage = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const numeric = Number(value);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(1)}%`;
};

export const formatPeriodLabel = (period) => {
  if (!period) return '';
  const raw = String(period).toUpperCase();
  const compact = raw.replace(/\s+/g, '');
  const flippedQuarterMatch = compact.match(/^(\d)Q(\d{2,4})$/) || compact.match(/^Q(\d)(\d{2,4})$/);
  if (flippedQuarterMatch) {
    const [, quarter, yearGroup] = flippedQuarterMatch;
    const fullYear = yearGroup.length === 2 ? `20${yearGroup}` : yearGroup;
    return `Q${quarter} ${fullYear}`;
  }
  if (/^Q\d/.test(raw) && /FY/.test(raw)) return raw.replace(/\s+/g, ' ').trim();
  if (/FY\d{2,4}/.test(raw)) return raw.replace(/ /g, ' ');
  if (/^\d{4}$/.test(raw)) return `${raw.slice(-2)}`;
  return raw.replace(/(\d{4})/g, ' $1').replace(/\s+/g, ' ').trim();
};
