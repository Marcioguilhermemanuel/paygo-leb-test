import { describe, it, expect } from 'vitest';
import { maskPhone, maskEmail, sanitizePayload, sanitizeHeaders } from '@paygo/shared';

describe('Sanitizer Unit Tests', () => {
  it('masks phone numbers correctly according to spec', () => {
    expect(maskPhone('923456789')).toBe('923***789');
    expect(maskPhone('+244923456789')).toBe('+24***789');
    expect(maskPhone('12')).toBe('***');
    expect(maskPhone(null)).toBe('');
  });

  it('masks customer email addresses correctly', () => {
    expect(maskEmail('cliente@example.com')).toBe('cli***@example.com');
    expect(maskEmail('user@paygo.ao')).toBe('use***@paygo.ao');
    expect(maskEmail(null)).toBe('');
  });

  it('sanitizes headers removing sensitive keys', () => {
    const headers = {
      'content-type': 'application/json',
      'x-api-key': 'secret-paygo-key-123',
      'Authorization': 'Bearer token-abc',
      'host': 'localhost:3333',
    };
    const sanitized = sanitizeHeaders(headers);
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['Authorization']).toBe('[REDACTED]');
    expect(sanitized['content-type']).toBe('application/json');
  });

  it('recursively sanitizes payload objects and masks PII', () => {
    const payload = {
      product_id: 'prod-123',
      apiKey: 'super-secret',
      customer_phone: '923456789',
      customer_email: 'marcio@test.com',
      nested: {
        x_api_key: 'nested-secret',
        phone: '912345678',
      },
    };
    const sanitized: any = sanitizePayload(payload);
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.customer_phone).toBe('923***789');
    expect(sanitized.customer_email).toBe('mar***@test.com');
    expect(sanitized.nested.x_api_key).toBe('[REDACTED]');
    expect(sanitized.nested.phone).toBe('912***678');
  });
});
