import { CreateProductInput, safeJsonStringify } from '@paygo/shared';
import { payGoClient, PayGoClient } from '../lib/paygo-client.js';
import { IProductRepository, productRepository, TestProductData } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

export class ProductService {
  constructor(
    private client: PayGoClient = payGoClient,
    private repo: IProductRepository = productRepository
  ) {}

  async createTestProduct(input: CreateProductInput): Promise<{
    success: boolean;
    product?: TestProductData;
    paygoResponse: any;
    error?: string;
  }> {
    logger.info('Creating test product on PayGo', {
      operation: 'create_test_product',
      name: input.name,
      price: input.price,
    });

    const response = await this.client.createProduct(input);

    if (!response.success || !response.data) {
      return {
        success: false,
        paygoResponse: response.raw,
        error: response.error?.message || 'Failed to create product on PayGo',
      };
    }

    const paygoData = response.data;
    const paygoProductId =
      paygoData.id ||
      paygoData.product_id ||
      paygoData.product?.id ||
      paygoData.product?.product_id ||
      paygoData.data?.id ||
      paygoData.data?.product_id ||
      paygoData.data?.product?.id ||
      paygoData.data?.product?.product_id;

    if (!paygoProductId) {
      logger.warn('PayGo product created but product ID could not be identified from response', {
        raw: response.raw,
      });
    }

    const saved = await this.repo.create({
      paygoProductId: String(paygoProductId || `unknown_${Date.now()}`),
      name: input.name,
      price: input.price,
      paymentMulticaixa: input.payment_multicaixa ?? true,
      paymentReference: input.payment_reference ?? true,
      paymentStripe: input.payment_stripe ?? false,
    });

    return {
      success: true,
      product: saved,
      paygoResponse: response.raw,
    };
  }

  async listProducts(): Promise<TestProductData[]> {
    return this.repo.list();
  }

  async listPayGoProducts() {
    return this.client.listProducts();
  }
}

export const productService = new ProductService();
