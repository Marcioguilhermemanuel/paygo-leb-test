import { describe, it, expect } from 'vitest';
import { calculateWebhookHmac, verifyWebhookSignature, computeEventHash } from '../lib/hmac.js';

describe('HMAC Webhook Verification Unit Tests', () => {
  const secret = 'super_secret_webhook_key_2026';
  const rawPayload = JSON.stringify({
    payment_id: 'pay_998877',
    status: 'completed',
    amount: 500,
    currency: 'AOA',
  });

  it('calculates correct HMAC-SHA256 signature', () => {
    const signature = calculateWebhookHmac(rawPayload, secret);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // SHA-256 hex length
  });

  it('verifies a valid signature successfully', () => {
    const signature = calculateWebhookHmac(rawPayload, secret);
    const result = verifyWebhookSignature(rawPayload, signature, secret);
    expect(result.isValid).toBe(true);
  });

  it('verifies a valid signature with sha256= prefix', () => {
    const signature = calculateWebhookHmac(rawPayload, secret);
    const result = verifyWebhookSignature(rawPayload, `sha256=${signature}`, secret);
    expect(result.isValid).toBe(true);
  });

  it('rejects an altered payload even by one character', () => {
    const signature = calculateWebhookHmac(rawPayload, secret);
    const alteredPayload = rawPayload.replace('500', '501');
    const result = verifyWebhookSignature(alteredPayload, signature, secret);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Signature mismatch');
  });

  it('rejects an invalid signature string', () => {
    const invalidSignature = 'a'.repeat(64);
    const result = verifyWebhookSignature(rawPayload, invalidSignature, secret);
    expect(result.isValid).toBe(false);
  });

  it('rejects when signature is missing', () => {
    const result = verifyWebhookSignature(rawPayload, null, secret);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Missing X-Webhook-Signature');
  });

  it('generates consistent deterministic event hash for replay detection', () => {
    const hash1 = computeEventHash(rawPayload);
    const hash2 = computeEventHash(rawPayload);
    expect(hash1).toBe(hash2);

    const hash3 = computeEventHash(rawPayload + ' ');
    expect(hash1).not.toBe(hash3);
  });
});
