export const SUPABASE_STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
export const PLUANG_CDN_BASE = 'https://image-cdn.pluang.com/icons/light/global-stocks';

export function getIdxLogoUrl(symbol) {
  return `${SUPABASE_STORAGE_BASE}/idx/${String(symbol).replace(/\.JK$/i, '')}.png`;
}

export function getUsLogoUrl(symbol) {
  return `${SUPABASE_STORAGE_BASE}/us/${symbol}.svg`;
}
