import crypto from 'node:crypto';
import { ApiLogEntry } from '@paygo/shared';
import { getPrismaClient } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface IRequestLogRepository {
  create(entry: ApiLogEntry): Promise<ApiLogEntry>;
  list(limit?: number): Promise<ApiLogEntry[]>;
}

export class PrismaRequestLogRepository implements IRequestLogRepository {
  private memoryFallback: ApiLogEntry[] = [];

  async create(entry: ApiLogEntry): Promise<ApiLogEntry> {
    try {
      const prisma = getPrismaClient();
      const created = await prisma.apiRequestLog.create({
        data: {
          id: entry.id || crypto.randomUUID(),
          provider: entry.provider,
          endpoint: entry.endpoint,
          method: entry.method,
          requestId: entry.requestId,
          httpStatus: entry.httpStatus,
          durationMs: entry.durationMs,
          success: entry.success,
          sanitizedRequest: entry.sanitizedRequest,
          sanitizedResponse: entry.sanitizedResponse,
          errorCode: entry.errorCode || null,
        },
      });
      return {
        id: created.id,
        provider: created.provider,
        endpoint: created.endpoint,
        method: created.method,
        requestId: created.requestId,
        httpStatus: created.httpStatus,
        durationMs: created.durationMs,
        success: created.success,
        sanitizedRequest: created.sanitizedRequest,
        sanitizedResponse: created.sanitizedResponse,
        errorCode: created.errorCode,
        createdAt: created.createdAt,
      };
    } catch (error) {
      logger.warn('Failed to save request log to Prisma DB, using in-memory store', {
        error: error instanceof Error ? error.message : String(error),
      });
      const logItem: ApiLogEntry = {
        ...entry,
        id: entry.id || crypto.randomUUID(),
        createdAt: new Date(),
      };
      this.memoryFallback.unshift(logItem);
      return logItem;
    }
  }

  async list(limit = 100): Promise<ApiLogEntry[]> {
    try {
      const prisma = getPrismaClient();
      const logs = await prisma.apiRequestLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return logs.map((l) => ({
        id: l.id,
        provider: l.provider,
        endpoint: l.endpoint,
        method: l.method,
        requestId: l.requestId,
        httpStatus: l.httpStatus,
        durationMs: l.durationMs,
        success: l.success,
        sanitizedRequest: l.sanitizedRequest,
        sanitizedResponse: l.sanitizedResponse,
        errorCode: l.errorCode,
        createdAt: l.createdAt,
      }));
    } catch (error) {
      return this.memoryFallback.slice(0, limit);
    }
  }
}
