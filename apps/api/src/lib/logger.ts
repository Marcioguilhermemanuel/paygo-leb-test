import crypto from 'node:crypto';
import { sanitizePayload, safeJsonStringify } from '@paygo/shared';

export function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export interface LogContext {
  requestId?: string;
  operation?: string;
  endpoint?: string;
  method?: string;
  paygoStatus?: number;
  durationMs?: number;
  [key: string]: any;
}

export const logger = {
  info(message: string, context?: LogContext) {
    const sanitizedCtx = context ? sanitizePayload(context) : {};
    console.log(
      `[INFO] ${new Date().toISOString()} - ${message}`,
      safeJsonStringify(sanitizedCtx)
    );
  },

  warn(message: string, context?: LogContext) {
    const sanitizedCtx = context ? sanitizePayload(context) : {};
    console.warn(
      `[WARN] ${new Date().toISOString()} - ${message}`,
      safeJsonStringify(sanitizedCtx)
    );
  },

  error(message: string, error?: any, context?: LogContext) {
    const sanitizedCtx = context ? sanitizePayload(context) : {};
    const errorDetails =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;

    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message}`,
      safeJsonStringify({
        ...sanitizedCtx,
        error: errorDetails,
      })
    );
  },
};
