const PORTFOLIO_CANONICAL_KEY = 'aruna-portfolio';
const PORTFOLIO_LEGACY_KEYS = [
  'portfolio_currency',
  'portfolio_visibility_hidden',
  'aruna_guest_portfolio',
  'aruna_guest_portfolio_seeded',
];
const PORTFOLIO_STALE_KEYS = [
  'aruna_portfolio',
  'aruna_portfolio_updated_at',
];
export const PORTFOLIO_STORAGE_KEYS = [
  PORTFOLIO_CANONICAL_KEY,
  ...PORTFOLIO_LEGACY_KEYS,
  ...PORTFOLIO_STALE_KEYS,
];

function isValidCanonical(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.entries)) return false;
  return true;
}

function read(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); }
  catch {
    // ponytail: storage quota / private-mode ceiling; ignore persistence write failures.
  }
}

export function loadPortfolio() {
  if (typeof window === 'undefined') return null;

  const raw = read(PORTFOLIO_CANONICAL_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidCanonical(parsed)) {
        return { entries: parsed.entries, currency: parsed.currency ?? 'IDR', visibilityHidden: parsed.visibilityHidden ?? false };
      }
    } catch { }
  }

  const legacyEntriesRaw = read('aruna_guest_portfolio');
  let legacyEntries = null;
  if (legacyEntriesRaw) {
    try {
      const parsed = JSON.parse(legacyEntriesRaw);
      if (Array.isArray(parsed)) legacyEntries = parsed;
    } catch { }
  }

  const legacyCurrency = read('portfolio_currency');
  const currency = ['IDR', 'USD', 'SGD'].includes(legacyCurrency) ? legacyCurrency : 'IDR';

  const legacyVisibility = read('portfolio_visibility_hidden');
  const visibilityHidden = legacyVisibility === 'true';

  const wasSeeded = read('aruna_guest_portfolio_seeded') === 'true';

  if (legacyEntries === null && !wasSeeded) return null;

  const canonical = {
    entries: legacyEntries ?? [],
    currency,
    visibilityHidden,
  };
  savePortfolio(canonical);
  return canonical;
}

export function savePortfolio(data) {
  if (typeof window === 'undefined') return;
  const { entries, currency = 'IDR', visibilityHidden = false } = data || {};
  if (!Array.isArray(entries)) return;
  write(PORTFOLIO_CANONICAL_KEY, JSON.stringify({ entries, currency, visibilityHidden }));
}
