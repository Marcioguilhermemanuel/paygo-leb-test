import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatePaymentInputSchema } from '@paygo/shared';
import { PayGoClient } from '../lib/paygo-client.js';
import { IRequestLogRepository } from '../repositories/index.js';

describe('PayGoClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends only documented payment fields to PayGo', async () => {
    const logRepo = {
      create: vi.fn(async (entry: any) => entry),
      list: vi.fn(async () => []),
    } as unknown as IRequestLogRepository;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new PayGoClient({
      baseUrl: 'https://paygo.example.test/api',
      apiKey: 'test-api-key',
      logRepo,
    });
    const input = CreatePaymentInputSchema.parse({
      product_id: 'paygo-product-123',
      payment_method: 'multicaixa' as const,
      customer_name: 'Synthetic Customer',
      customer_email: 'synthetic@example.test',
      customer_phone: '923000111',
      order_bump_ids: ['bump-123'],
      idempotency_key: 'lab-only-idempotency-key',
      confirmed_live: false,
    });

    await client.createPayment(input);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe('https://paygo.example.test/api/payments');
    const request = fetchSpy.mock.calls[0][1];
    expect(request?.method).toBe('POST');
    const headers = new Headers(request?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-api-key')).toBe('test-api-key');
    expect([...headers.keys()].sort()).toEqual(['content-type', 'x-api-key']);
    expect(JSON.parse(String(request?.body))).toEqual({
      product_id: 'paygo-product-123',
      payment_method: 'multicaixa',
      customer_name: 'Synthetic Customer',
      customer_email: 'synthetic@example.test',
      customer_phone: '923000111',
      order_bump_ids: ['bump-123'],
    });
  });

  it('preserves the complete PayGo error body and logs it sanitized', async () => {
    const logRepo = {
      create: vi.fn(async (entry: any) => entry),
      list: vi.fn(async () => []),
    } as unknown as IRequestLogRepository;
    const responseBody = {
      error: 'The payment was refused by Multicaixa Express system.',
      details: {
        success: false,
        error: 'The payment was refused by Multicaixa Express system.',
        paymentId: 'internal-response-id',
        status: 'failed',
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new PayGoClient({
      baseUrl: 'https://paygo.example.test/api',
      apiKey: 'test-api-key',
      logRepo,
    });

    const result = await client.createPayment({
      product_id: 'paygo-product-123',
      payment_method: 'multicaixa',
      customer_name: 'Synthetic Customer',
      customer_email: 'synthetic@example.test',
      customer_phone: '923000111',
    });

    expect(result.status).toBe(400);
    expect(result.raw).toEqual(responseBody);
    expect(result.error?.details).toEqual(responseBody);
    const loggedEntry = (logRepo.create as any).mock.calls[0][0];
    expect(JSON.parse(loggedEntry.sanitizedResponse)).toEqual(responseBody);
  });
});