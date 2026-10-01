import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { calculateWebhookHmac } from '../lib/hmac.js';
import { env } from '../config/env.js';

describe('Fastify API Routes & Webhook Integration Tests', () => {
  let app: FastifyInstance;
  const testSecret = 'integration_test_secret_key_123';

  beforeAll(async () => {
    // Configure test secret
    (env as any).PAYGO_WEBHOOK_SECRET = testSecret;
    app = await buildServer();
    await app.ready();
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 60000);

  it('GET /health returns 200 with system diagnostics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.mode).toBeDefined();
  });

  it('POST /webhooks/paygo rejects payload when X-Webhook-Signature is missing (401)', async () => {
    const payload = JSON.stringify({ payment_id: 'pay_test_001', status: 'completed' });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/paygo',
      headers: {
        'content-type': 'application/json',
      },
      payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /webhooks/paygo rejects payload with tampered signature (401)', async () => {
    const payload = JSON.stringify({ payment_id: 'pay_test_002', status: 'completed' });
    const fakeSignature = 'b'.repeat(64);
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/paygo',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': fakeSignature,
      },
      payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /webhooks/paygo accepts payload with valid HMAC-SHA256 signature (200)', async () => {
    const payload = JSON.stringify({
      payment_id: 'pay_test_003',
      status: 'completed',
      amount: 100,
    });
    const validSignature = calculateWebhookHmac(payload, testSecret);

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/paygo',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': validSignature,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('POST /webhooks/paygo detects duplicate/replay webhook and handles idempotently (200)', async () => {
    const payload = JSON.stringify({
      payment_id: 'pay_test_replay_004',
      status: 'completed',
      amount: 250,
    });
    const validSignature = calculateWebhookHmac(payload, testSecret);

    // First arrival
    const res1 = await app.inject({
      method: 'POST',
      url: '/webhooks/paygo',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': validSignature,
      },
      payload,
    });
    expect(res1.statusCode).toBe(200);

    // Duplicate replay
    const res2 = await app.inject({
      method: 'POST',
      url: '/webhooks/paygo',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': validSignature,
      },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.duplicate).toBe(true);
  });

  it('POST /test/products rejects invalid input with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/products',
      payload: {
        // Missing name and negative price
        price: -50,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /test/products requires a valid thank_you_url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/products',
      payload: {
        name: 'Lab Test Product',
        price: 1,
        payment_multicaixa: true,
        payment_reference: true,
        payment_stripe: false,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /test/payments rejects invalid payment method with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/payments',
      payload: {
        product_id: 'prod_123',
        payment_method: 'invalid_method',
        customer_name: 'Test',
        customer_email: 'test@example.com',
        customer_phone: '923456789',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
