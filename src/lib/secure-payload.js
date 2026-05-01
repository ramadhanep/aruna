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

function xorBytes(input, keyBytes) {
  const output = new Uint8Array(input.length);
  const keyLength = keyBytes.length;
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] ^ keyBytes[i % keyLength];
  }
  return output;
}

export function encodePayload(data, keyOverride) {
  const key = ensureKey(keyOverride);
  const payloadString = JSON.stringify(data ?? {});
  const payloadBytes = encoder.encode(payloadString);
  const keyBytes = encoder.encode(key);
  const cipherBytes = xorBytes(payloadBytes, keyBytes);
  return base64Encode(cipherBytes);
}

export function decodePayload(payload, keyOverride) {
  if (typeof payload !== 'string' || !payload) {
    return null;
  }
  const key = ensureKey(keyOverride);
  const cipherBytes = base64Decode(payload);
  const keyBytes = encoder.encode(key);
  const plainBytes = xorBytes(cipherBytes, keyBytes);
  const jsonString = decoder.decode(plainBytes);
  try {
    return JSON.parse(jsonString);
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
