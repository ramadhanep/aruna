import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { PLUANG_CDN_BASE, getUsLogoUrl } from '@/lib/supabase-storage';

/**
 * Ensure a US stock logo exists in Supabase storage.
 * If missing, download from Pluang CDN and upload automatically.
 * Returns the Supabase public URL (or null on failure).
 */
export async function ensureUsLogo(normalizedSymbol) {
  const supabaseUrl = getUsLogoUrl(normalizedSymbol);

  try {
    const headRes = await fetch(supabaseUrl, { method: 'HEAD' });
    if (headRes.ok) {
      return supabaseUrl;
    }

    const cdnUrl = `${PLUANG_CDN_BASE}/${normalizedSymbol.toLowerCase()}.svg`;
    const cdnRes = await fetch(cdnUrl);
    if (!cdnRes.ok) {
      console.warn(`Pluang CDN returned ${cdnRes.status} for ${normalizedSymbol}`);
      return null;
    }

    const svgBuffer = Buffer.from(await cdnRes.arrayBuffer());

    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) {
      console.warn('Supabase service role client unavailable, skipping logo upload');
      return null;
    }

    const { error: uploadError } = await supabase.storage
      .from('us')
      .upload(`${normalizedSymbol}.svg`, svgBuffer, {
        contentType: 'image/svg+xml',
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Failed to upload ${normalizedSymbol}.svg to Supabase:`, uploadError.message);
      return null;
    }

    return supabaseUrl;
  } catch (err) {
    console.warn(`ensureUsLogo error for ${normalizedSymbol}:`, err.message);
    return null;
  }
}
