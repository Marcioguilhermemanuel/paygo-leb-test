import crypto from 'node:crypto';
import { getPrismaClient } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { TestPaymentData } from './types.js';
import { PaymentStatus } from '@prisma/client';

export interface IPaymentRepository {
  create(payment: Omit<TestPaymentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPaymentData>;
  findById(id: string): Promise<TestPaymentData | null>;
  findByPaygoId(paygoPaymentId: string): Promise<TestPaymentData | null>;
  findByIdempotencyKey(key: string): Promise<TestPaymentData | null>;
  update(id: string, data: Partial<TestPaymentData>): Promise<TestPaymentData>;
  list(limit?: number): Promise<TestPaymentData[]>;
}

export class PrismaPaymentRepository implements IPaymentRepository {
  private memoryStore: Map<string, TestPaymentData> = new Map();
  private idempotencyMap: Map<string, string> = new Map(); // key -> paymentId

  async create(payment: Omit<TestPaymentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPaymentData> {
    const existing = await this.findByIdempotencyKey(payment.idempotencyKey);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    const now = new Date();

    try {
      const prisma = getPrismaClient();
      const created = await prisma.testPayment.create({
        data: {
          id,
          paygoPaymentId: payment.paygoPaymentId || null,
          testProductId: payment.testProductId || null,
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status as PaymentStatus,
          customerName: payment.customerName,
          customerEmail: payment.customerEmail,
          customerPhone: payment.customerPhone,
          idempotencyKey: payment.idempotencyKey,
          itemsJson: payment.itemsJson || null,
          rawPaygoResponse: payment.rawPaygoResponse || null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const res: TestPaymentData = {
        id: created.id,
        paygoPaymentId: created.paygoPaymentId,
        testProductId: created.testProductId,
        paymentMethod: created.paymentMethod as any,
        amount: Number(created.amount),
        currency: created.currency,
        status: created.status as any,
        customerName: created.customerName,
        customerEmail: created.customerEmail,
        customerPhone: created.customerPhone,
        idempotencyKey: created.idempotencyKey,
        itemsJson: created.itemsJson,
        rawPaygoResponse: created.rawPaygoResponse,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        completedAt: created.completedAt,
        failedAt: created.failedAt,
        cancelledAt: created.cancelledAt,
      };

      this.memoryStore.set(res.id, res);
      this.idempotencyMap.set(res.idempotencyKey, res.id);
      return res;
    } catch (error: any) {
      // In case of unique constraint violation on idempotencyKey
      if (error?.code === 'P2002' || String(error).includes('Unique constraint')) {
        const found = await this.findByIdempotencyKey(payment.idempotencyKey);
        if (found) return found;
      }

      logger.warn('Failed to save payment in Prisma, falling back to memory', {
        error: error instanceof Error ? error.message : String(error),
      });

      const memoryPayment: TestPaymentData = {
        ...payment,
        id,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryStore.set(id, memoryPayment);
      this.idempotencyMap.set(payment.idempotencyKey, id);
      return memoryPayment;
    }
  }

  async findById(id: string): Promise<TestPaymentData | null> {
    try {
      const prisma = getPrismaClient();
      const p = await prisma.testPayment.findUnique({
        where: { id },
      });
      if (!p) return null;
      return {
        id: p.id,
        paygoPaymentId: p.paygoPaymentId,
        testProductId: p.testProductId,
        paymentMethod: p.paymentMethod as any,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status as any,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        idempotencyKey: p.idempotencyKey,
        itemsJson: p.itemsJson,
        rawPaygoResponse: p.rawPaygoResponse,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        cancelledAt: p.cancelledAt,
      };
    } catch {
      return this.memoryStore.get(id) || null;
    }
  }

  async findByPaygoId(paygoPaymentId: string): Promise<TestPaymentData | null> {
    try {
      const prisma = getPrismaClient();
      const p = await prisma.testPayment.findUnique({
        where: { paygoPaymentId },
      });
      if (!p) return null;
      return {
        id: p.id,
        paygoPaymentId: p.paygoPaymentId,
        testProductId: p.testProductId,
        paymentMethod: p.paymentMethod as any,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status as any,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        idempotencyKey: p.idempotencyKey,
        itemsJson: p.itemsJson,
        rawPaygoResponse: p.rawPaygoResponse,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        cancelledAt: p.cancelledAt,
      };
    } catch {
      for (const item of this.memoryStore.values()) {
        if (item.paygoPaymentId === paygoPaymentId) return item;
      }
      return null;
    }
  }

  async findByIdempotencyKey(key: string): Promise<TestPaymentData | null> {
    try {
      const prisma = getPrismaClient();
      const p = await prisma.testPayment.findUnique({
        where: { idempotencyKey: key },
      });
      if (!p) return null;
      return {
        id: p.id,
        paygoPaymentId: p.paygoPaymentId,
        testProductId: p.testProductId,
        paymentMethod: p.paymentMethod as any,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status as any,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        idempotencyKey: p.idempotencyKey,
        itemsJson: p.itemsJson,
        rawPaygoResponse: p.rawPaygoResponse,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        cancelledAt: p.cancelledAt,
      };
    } catch {
      const id = this.idempotencyMap.get(key);
      if (!id) return null;
      return this.memoryStore.get(id) || null;
    }
  }

  async update(id: string, data: Partial<TestPaymentData>): Promise<TestPaymentData> {
    const now = new Date();
    try {
      const prisma = getPrismaClient();
      const updatePayload: any = {
        updatedAt: now,
      };
      if (data.status) updatePayload.status = data.status;
      if (data.paygoPaymentId) updatePayload.paygoPaymentId = data.paygoPaymentId;
      if (data.rawPaygoResponse) updatePayload.rawPaygoResponse = data.rawPaygoResponse;
      if (data.completedAt !== undefined) updatePayload.completedAt = data.completedAt;
      if (data.failedAt !== undefined) updatePayload.failedAt = data.failedAt;
      if (data.cancelledAt !== undefined) updatePayload.cancelledAt = data.cancelledAt;

      const updated = await prisma.testPayment.update({
        where: { id },
        data: updatePayload,
      });

      const res: TestPaymentData = {
        id: updated.id,
        paygoPaymentId: updated.paygoPaymentId,
        testProductId: updated.testProductId,
        paymentMethod: updated.paymentMethod as any,
        amount: Number(updated.amount),
        currency: updated.currency,
        status: updated.status as any,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        idempotencyKey: updated.idempotencyKey,
        itemsJson: updated.itemsJson,
        rawPaygoResponse: updated.rawPaygoResponse,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        completedAt: updated.completedAt,
        failedAt: updated.failedAt,
        cancelledAt: updated.cancelledAt,
      };

      this.memoryStore.set(id, res);
      return res;
    } catch (error) {
      const current = this.memoryStore.get(id);
      if (!current) {
        throw new Error(`Payment ${id} not found in repository`);
      }
      const updated: TestPaymentData = {
        ...current,
        ...data,
        updatedAt: now,
      };
      this.memoryStore.set(id, updated);
      return updated;
    }
  }

  async list(limit = 100): Promise<TestPaymentData[]> {
    try {
      const prisma = getPrismaClient();
      const list = await prisma.testPayment.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return list.map((p) => ({
        id: p.id,
        paygoPaymentId: p.paygoPaymentId,
        testProductId: p.testProductId,
        paymentMethod: p.paymentMethod as any,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status as any,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        idempotencyKey: p.idempotencyKey,
        itemsJson: p.itemsJson,
        rawPaygoResponse: p.rawPaygoResponse,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        cancelledAt: p.cancelledAt,
      }));
    } catch {
      return Array.from(this.memoryStore.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    }
  }
}
