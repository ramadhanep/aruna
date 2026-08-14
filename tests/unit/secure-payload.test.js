import { describe, it, expect } from 'vitest';
import { encodePayload, decodePayload, decodeApiResponse } from '@/lib/secure-payload';

const TEST_KEY = 'aruna-test-key-1234';

describe('secure-payload', () => {
  describe('encodePayload / decodePayload', () => {
    it('roundtrips objects', () => {
      const data = { symbol: 'BBRI.JK', price: 5100, meta: { cached: 1, fetched: 0 } };
      const encoded = encodePayload(data, TEST_KEY);
      expect(typeof encoded).toBe('string');
      expect(decodePayload(encoded, TEST_KEY)).toEqual(data);
    });

    it('roundtrips nested arrays and primitives', () => {
      const data = { list: [1, 2, 3], ok: true, nothing: null };
      expect(decodePayload(encodePayload(data, TEST_KEY), TEST_KEY)).toEqual(data);
    });

    it('encodes without revealing plaintext in base64', () => {
      const encoded = encodePayload({ secret: 'BBRI.JK' }, TEST_KEY);
      expect(encoded).not.toContain('BBRI');
      expect(encoded).not.toContain('secret');
    });

    it('requires a configured key', () => {
      const saved = process.env.SECURE_PAYLOAD_KEY;
      delete process.env.SECURE_PAYLOAD_KEY;
      expect(() => encodePayload({}, undefined)).toThrow('Secure payload key is not configured');
      if (saved) process.env.SECURE_PAYLOAD_KEY = saved;
    });
  });

  describe('decodePayload edge cases', () => {
    it('returns null for non-string input', () => {
      expect(decodePayload(null, TEST_KEY)).toBeNull();
      expect(decodePayload(undefined, TEST_KEY)).toBeNull();
      expect(decodePayload(42, TEST_KEY)).toBeNull();
    });

    it('returns null for garbage payload', () => {
      expect(decodePayload('not-a-valid-payload', TEST_KEY)).toBeNull();
    });
  });

  describe('decodeApiResponse', () => {
    it('decodes the {"payload": "..."} envelope', () => {
      const body = { payload: encodePayload({ ok: true }, TEST_KEY) };
      expect(decodeApiResponse(body, TEST_KEY)).toEqual({ ok: true });
    });

    it('returns null for invalid bodies', () => {
      expect(decodeApiResponse(null, TEST_KEY)).toBeNull();
      expect(decodeApiResponse({}, TEST_KEY)).toBeNull();
    });
  });
});
