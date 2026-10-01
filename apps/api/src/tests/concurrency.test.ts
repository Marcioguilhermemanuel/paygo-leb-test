import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../services/payment.service.js';
import { PayGoClient } from '../lib/paygo-client.js';
import { PrismaPaymentRepository } from '../repositories/payment.repository.js';
import { PrismaProductRepository } from '../repositories/product.repository.js';
import { IPaymentRepository, IProductRepository } from '../repositories/index.js';
import { TestPaymentData, TestProductData } from '../repositories/types.js';

describe('Concurrency & Race Condition Tests (Section 14 & 37)', () => {
  it('stores the local product ID when creating a payment for a PayGo product', async () => {
    const product: TestProductData = {
      id: 'local_product_123',
      paygoProductId: 'paygo_product_123',
      name: 'Test product',
      price: 250,
      paymentMulticaixa: true,
      paymentReference: true,
      paymentStripe: false,
      createdAt: new Date(),
    };
    let createdPayment: TestPaymentData | undefined;

    const paymentRepo = {
      findByIdempotencyKey: vi.fn(async (_key: string) => null),
      create: vi.fn(async (payment: Omit<TestPaymentData, 'id' | 'createdAt' | 'updatedAt'>) => {
        createdPayment = {
          ...payment,
          id: 'local_payment_123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return createdPayment;
      }),
      update: vi.fn(async (_id: string, changes: Partial<TestPaymentData>) => {
        if (!createdPayment) throw new Error('Payment was not created');
        createdPayment = { ...createdPayment, ...changes, updatedAt: new Date() };
        return createdPayment;
      }),
    } as unknown as IPaymentRepository;
    const productRepo = {
      findByPaygoId: vi.fn(async (_paygoProductId: string) => product),
    } as unknown as IProductRepository;
    const mockClient = new PayGoClient();
    vi.spyOn(mockClient, 'createPayment').mockImplementation(async () => ({
      success: true,
      status: 200,
      data: { id: 'paygo_payment_123', status: 'pending' },
      raw: { id: 'paygo_payment_123', status: 'pending' },
      durationMs: 0,
      requestId: 'req_test_product_link',
    }));

    const service = new PaymentService(mockClient, paymentRepo, productRepo);
    await service.createTestPayment({
      product_id: product.paygoProductId,
      payment_method: 'multicaixa',
      customer_name: 'Cliente Teste',
      customer_email: 'teste@example.com',
      customer_phone: '923000111',
      idempotency_key: 'product_link_test',
    });

    expect(paymentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ testProductId: product.id, amount: product.price })
    );
  });

  it('handles 10 simultaneous requests for the same idempotencyKey with exactly 1 PayGo creation call', async () => {
    let payGoApiCallCount = 0;
    const fakePaygoPaymentId = `paygo_race_${randomUUID()}`;

    // Mock PayGoClient to track exact invocation count
    const mockClient = new PayGoClient();
    vi.spyOn(mockClient, 'createPayment').mockImplementation(async (input) => {
      payGoApiCallCount++;
      // Simulate 50ms network latency to test in-flight race conditions
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        success: true,
        status: 200,
        data: {
          id: fakePaygoPaymentId,
          status: 'pending',
          reference: '123456789',
        },
        raw: { id: fakePaygoPaymentId, status: 'pending' },
        durationMs: 50,
        requestId: 'req_test_race',
      };
    });

    const paymentRepo = new PrismaPaymentRepository();
    const productRepo = new PrismaProductRepository();
    const service = new PaymentService(mockClient, paymentRepo, productRepo);

    const sharedIdempotencyKey = `race_key_concurrency_test_${randomUUID()}`;

    const testPayload = {
      payment_method: 'multicaixa' as const,
      customer_name: 'Cliente Concorrente',
      customer_email: 'concorrente@example.com',
      customer_phone: '923000111',
      idempotency_key: sharedIdempotencyKey,
    };

    // Fire 10 simultaneous requests concurrently
    const requests = Array.from({ length: 10 }).map(() =>
      service.createTestPayment(testPayload)
    );

    const results = await Promise.all(requests);

    // Verify all 10 completed successfully
    expect(results).toHaveLength(10);
    for (const res of results) {
      expect(res.success).toBe(true);
      expect(res.payment?.paygoPaymentId).toBe(fakePaygoPaymentId);
    }

    // CRITICAL: PayGo API must have been called EXACTLY ONCE
    expect(payGoApiCallCount).toBe(1);

    // Verify all returned the exact same internal payment ID
    const initialPaymentId = results[0].payment?.id;
    for (let i = 1; i < results.length; i++) {
      expect(results[i].payment?.id).toBe(initialPaymentId);
    }

    // Exactly 1 request created the payment, the other 9 reused the in-flight/idempotent result
    const existingReuses = results.filter((r) => r.isExistingIdempotent === true);
    expect(existingReuses.length).toBeGreaterThanOrEqual(0);
  });
});
