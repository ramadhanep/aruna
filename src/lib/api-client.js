import { decodeApiResponse } from '@/lib/secure-payload';

export async function fetchEncodedJson(input, init) {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({}));
  const decoded = decodeApiResponse(body);
  if (!decoded) {
    throw new Error('Failed to decode API response');
  }
  return { response, data: decoded };
}
