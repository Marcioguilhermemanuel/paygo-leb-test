import crypto from 'node:crypto';
import { getPrismaClient } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { WebhookEventData } from './types.js';

export interface IWebhookEventRepository {
  create(event: Omit<WebhookEventData, 'id' | 'createdAt' | 'processedAt'>): Promise<WebhookEventData>;
  findByEventHash(hash: string): Promise<WebhookEventData | null>;
  markProcessed(id: string, paymentId?: string, error?: string): Promise<WebhookEventData>;
  list(limit?: number): Promise<WebhookEventData[]>;
  getStats(): Promise<{ received: number; valid: number; invalid: number; duplicate: number }>;
}

export class PrismaWebhookEventRepository implements IWebhookEventRepository {
  private memoryStore: Map<string, WebhookEventData> = new Map();

  async create(event: Omit<WebhookEventData, 'id' | 'createdAt' | 'processedAt'>): Promise<WebhookEventData> {
    const id = crypto.randomUUID();
    const now = new Date();
    try {
      const prisma = getPrismaClient();
      const created = await prisma.webhookEvent.create({
        data: {
          id,
          provider: event.provider,
          signature: event.signature,
          signatureValid: event.signatureValid,
          eventHash: event.eventHash,
          payload: event.payload,
          processed: event.processed,
          processingError: event.processingError || null,
          paymentId: event.paymentId || null,
          createdAt: now,
        },
      });
      const res: WebhookEventData = {
        id: created.id,
        provider: created.provider,
        signature: created.signature,
        signatureValid: created.signatureValid,
        eventHash: created.eventHash,
        payload: created.payload,
        processed: created.processed,
        processingError: created.processingError,
        paymentId: created.paymentId,
        createdAt: created.createdAt,
        processedAt: created.processedAt,
      };
      this.memoryStore.set(res.id, res);
      return res;
    } catch (error) {
      logger.warn('Failed to save webhook event to Prisma DB, using memory fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      const res: WebhookEventData = {
        ...event,
        id,
        createdAt: now,
        processedAt: null,
      };
      this.memoryStore.set(id, res);
      return res;
    }
  }

  async findByEventHash(hash: string): Promise<WebhookEventData | null> {
    try {
      const prisma = getPrismaClient();
      const found = await prisma.webhookEvent.findFirst({
        where: { eventHash: hash },
      });
      if (!found) return null;
      return {
        id: found.id,
        provider: found.provider,
        signature: found.signature,
        signatureValid: found.signatureValid,
        eventHash: found.eventHash,
        payload: found.payload,
        processed: found.processed,
        processingError: found.processingError,
        paymentId: found.paymentId,
        createdAt: found.createdAt,
        processedAt: found.processedAt,
      };
    } catch {
      for (const ev of this.memoryStore.values()) {
        if (ev.eventHash === hash) return ev;
      }
      return null;
    }
  }

  async markProcessed(id: string, paymentId?: string, error?: string): Promise<WebhookEventData> {
    const now = new Date();
    try {
      const prisma = getPrismaClient();
      const updated = await prisma.webhookEvent.update({
        where: { id },
        data: {
          processed: true,
          processingError: error || null,
          paymentId: paymentId || undefined,
          processedAt: now,
        },
      });
      const res: WebhookEventData = {
        id: updated.id,
        provider: updated.provider,
        signature: updated.signature,
        signatureValid: updated.signatureValid,
        eventHash: updated.eventHash,
        payload: updated.payload,
        processed: updated.processed,
        processingError: updated.processingError,
        paymentId: updated.paymentId,
        createdAt: updated.createdAt,
        processedAt: updated.processedAt,
      };
      this.memoryStore.set(id, res);
      return res;
    } catch {
      const current = this.memoryStore.get(id);
      if (!current) throw new Error(`Webhook event ${id} not found`);
      const updated: WebhookEventData = {
        ...current,
        processed: true,
        processingError: error || null,
        paymentId: paymentId || current.paymentId,
        processedAt: now,
      };
      this.memoryStore.set(id, updated);
      return updated;
    }
  }

  async list(limit = 100): Promise<WebhookEventData[]> {
    try {
      const prisma = getPrismaClient();
      const events = await prisma.webhookEvent.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return events.map((e) => ({
        id: e.id,
        provider: e.provider,
        signature: e.signature,
        signatureValid: e.signatureValid,
        eventHash: e.eventHash,
        payload: e.payload,
        processed: e.processed,
        processingError: e.processingError,
        paymentId: e.paymentId,
        createdAt: e.createdAt,
        processedAt: e.processedAt,
      }));
    } catch {
      return Array.from(this.memoryStore.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    }
  }

  async getStats(): Promise<{ received: number; valid: number; invalid: number; duplicate: number }> {
    const all = await this.list(1000);
    const seenHashes = new Set<string>();
    let duplicate = 0;
    let valid = 0;
    let invalid = 0;

    for (const ev of all) {
      if (seenHashes.has(ev.eventHash)) {
        duplicate++;
      } else {
        seenHashes.add(ev.eventHash);
      }
      if (ev.signatureValid) {
        valid++;
      } else {
        invalid++;
      }
    }

    return {
      received: all.length,
      valid,
      invalid,
      duplicate,
    };
  }
}
