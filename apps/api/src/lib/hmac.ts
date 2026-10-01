import crypto from 'node:crypto';
import { WebhookVerificationResult } from '@paygo/shared';

/**
 * Calculates HMAC-SHA256 of raw body using webhook secret.
 */
export function calculateWebhookHmac(rawBody: string | Buffer, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  return hmac.digest('hex');
}

/**
 * Generates deterministic SHA-256 hash of payload for deduplication / replay detection.
 */
export function computeEventHash(rawBody: string | Buffer): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Validates incoming webhook signature in constant time against calculated HMAC.
 * Safe against timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  providedSignature: string | null | undefined,
  secret: string
): WebhookVerificationResult {
  if (!providedSignature) {
    return {
      isValid: false,
      reason: 'Missing X-Webhook-Signature header',
    };
  }

  if (!secret) {
    return {
      isValid: false,
      reason: 'PAYGO_WEBHOOK_SECRET is not configured on server',
    };
  }

  // Normalize signature: strip "sha256=" prefix if present
  const cleanProvided = providedSignature.startsWith('sha256=')
    ? providedSignature.slice(7)
    : providedSignature;

  const expectedHmacHex = calculateWebhookHmac(rawBody, secret);

  try {
    const providedBuffer = Buffer.from(cleanProvided.trim(), 'hex');
    const expectedBuffer = Buffer.from(expectedHmacHex, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return {
        isValid: false,
        reason: 'Signature buffer length mismatch',
        calculatedSignature: expectedHmacHex,
      };
    }

    const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);

    return {
      isValid,
      reason: isValid ? 'Signature valid' : 'Signature mismatch',
      calculatedSignature: expectedHmacHex,
    };
  } catch (error) {
    return {
      isValid: false,
      reason: `Signature parsing error: ${error instanceof Error ? error.message : String(error)}`,
      calculatedSignature: expectedHmacHex,
    };
  }
}
