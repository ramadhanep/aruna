const encoder = new TextEncoder();
const decoder = new TextDecoder();

function ensureKey(customKey) {
  const key =
    customKey ||
    process.env.SECURE_PAYLOAD_KEY;
  if (!key) {
    throw new Error('Secure payload key is not configured');
  }
  return key;
}

function base64Encode(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  throw new Error('No base64 encoder available');
}

function base64Decode(text) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(text, 'base64'));
  }
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('No base64 decoder available');
}

export function encodePayload(data, keyOverride) {
  ensureKey(keyOverride);
  return base64Encode(encoder.encode(JSON.stringify(data ?? {})));
}

export function decodePayload(payload, keyOverride) {
  if (typeof payload !== 'string' || !payload) {
    return null;
  }
  ensureKey(keyOverride);
  try {
    return JSON.parse(decoder.decode(base64Decode(payload)));
  } catch {
    return null;
  }
}

export function decodeApiResponse(body, keyOverride) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  return decodePayload(body.payload, keyOverride);
}
