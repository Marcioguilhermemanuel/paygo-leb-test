import { describe, expect, it, vi } from 'vitest';
import { PayGoClient } from '../lib/paygo-client.js';
import { IProductRepository } from '../repositories/index.js';
import { ProductService } from '../services/product.service.js';

describe('ProductService', () => {
  it.each([
    { shape: 'product.id', product: { id: 'paygo-product-123' } },
    { shape: 'product.product_id', product: { product_id: 'paygo-product-456' } },
  ])('extracts the PayGo product ID from $shape', async ({ product }) => {
    const response = {
      success: true,
      product: { ...product, name: 'Lab Test Product', price: 1 },
    };
    const create = vi.fn(async (product: any) => ({
      ...product,
      id: 'local-product-123',
      createdAt: new Date(),
    }));
    const repository = { create } as unknown as IProductRepository;
    const client = {
      createProduct: vi.fn().mockResolvedValue({
        success: true,
        status: 201,
        data: response,
        raw: response,
        durationMs: 1,
        requestId: 'req_product_test',
      }),
    } as unknown as PayGoClient;
    const service = new ProductService(client, repository);

    const result = await service.createTestProduct({
      name: 'Lab Test Product',
      price: 1,
      thank_you_url: 'https://lab.example/thank-you',
      payment_multicaixa: true,
      payment_reference: true,
      payment_stripe: false,
    });

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ paygoProductId: Object.values(product)[0] })
    );
  });
});