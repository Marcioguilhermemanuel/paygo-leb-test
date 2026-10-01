import crypto from 'node:crypto';
import { getPrismaClient } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { TestProductData } from './types.js';

export interface IProductRepository {
  create(product: Omit<TestProductData, 'id' | 'createdAt'>): Promise<TestProductData>;
  findByPaygoId(paygoProductId: string): Promise<TestProductData | null>;
  findById(id: string): Promise<TestProductData | null>;
  list(): Promise<TestProductData[]>;
}

export class PrismaProductRepository implements IProductRepository {
  private memoryStore: Map<string, TestProductData> = new Map();

  async create(product: Omit<TestProductData, 'id' | 'createdAt'>): Promise<TestProductData> {
    try {
      const prisma = getPrismaClient();
      const created = await prisma.testProduct.create({
        data: {
          id: crypto.randomUUID(),
          paygoProductId: product.paygoProductId,
          name: product.name,
          price: product.price,
          paymentMulticaixa: product.paymentMulticaixa,
          paymentReference: product.paymentReference,
          paymentStripe: product.paymentStripe,
        },
      });
      const result: TestProductData = {
        id: created.id,
        paygoProductId: created.paygoProductId,
        name: created.name,
        price: Number(created.price),
        paymentMulticaixa: created.paymentMulticaixa,
        paymentReference: created.paymentReference,
        paymentStripe: created.paymentStripe,
        createdAt: created.createdAt,
      };
      this.memoryStore.set(result.id, result);
      return result;
    } catch (error) {
      logger.warn('Failed to save product in Prisma, using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      const item: TestProductData = {
        ...product,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      this.memoryStore.set(item.id, item);
      return item;
    }
  }

  async findByPaygoId(paygoProductId: string): Promise<TestProductData | null> {
    try {
      const prisma = getPrismaClient();
      const found = await prisma.testProduct.findUnique({
        where: { paygoProductId },
      });
      if (!found) return null;
      return {
        id: found.id,
        paygoProductId: found.paygoProductId,
        name: found.name,
        price: Number(found.price),
        paymentMulticaixa: found.paymentMulticaixa,
        paymentReference: found.paymentReference,
        paymentStripe: found.paymentStripe,
        createdAt: found.createdAt,
      };
    } catch {
      for (const prod of this.memoryStore.values()) {
        if (prod.paygoProductId === paygoProductId) return prod;
      }
      return null;
    }
  }

  async findById(id: string): Promise<TestProductData | null> {
    try {
      const prisma = getPrismaClient();
      const found = await prisma.testProduct.findUnique({
        where: { id },
      });
      if (!found) return null;
      return {
        id: found.id,
        paygoProductId: found.paygoProductId,
        name: found.name,
        price: Number(found.price),
        paymentMulticaixa: found.paymentMulticaixa,
        paymentReference: found.paymentReference,
        paymentStripe: found.paymentStripe,
        createdAt: found.createdAt,
      };
    } catch {
      return this.memoryStore.get(id) || null;
    }
  }

  async list(): Promise<TestProductData[]> {
    try {
      const prisma = getPrismaClient();
      const prods = await prisma.testProduct.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return prods.map((p) => ({
        id: p.id,
        paygoProductId: p.paygoProductId,
        name: p.name,
        price: Number(p.price),
        paymentMulticaixa: p.paymentMulticaixa,
        paymentReference: p.paymentReference,
        paymentStripe: p.paymentStripe,
        createdAt: p.createdAt,
      }));
    } catch {
      return Array.from(this.memoryStore.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }
  }
}
