import {
  CreateProductInput,
  CreatePaymentInput,
  NormalizedApiResponse,
  safeJsonStringify,
  sanitizePayload,
} from '@paygo/shared';
import { env, isPayGoConfigured } from '../config/env.js';
import { generateRequestId, logger } from './logger.js';
import { IRequestLogRepository, requestLogRepository } from '../repositories/index.js';

export interface PayGoClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  logRepo?: IRequestLogRepository;
}

export class PayGoClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private logRepo: IRequestLogRepository;

  constructor(config?: PayGoClientConfig) {
    this.baseUrl = (config?.baseUrl || env.PAYGO_BASE_URL).replace(/\/+$/, '');
    this.apiKey = config?.apiKey || env.PAYGO_API_KEY || '';
    this.timeoutMs = config?.timeoutMs || 15000;
    this.logRepo = config?.logRepo || requestLogRepository;
  }

  private async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      customTimeoutMs?: number;
    } = {}
  ): Promise<NormalizedApiResponse<T>> {
    const requestId = generateRequestId();
    const method = options.method || 'GET';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const startTime = Date.now();

    if (!this.apiKey) {
      const durationMs = Date.now() - startTime;
      const errorMsg = 'PAYGO_API_KEY is not configured. Real PayGo requests cannot be made.';
      logger.warn(errorMsg, { requestId, operation: 'paygo_client_request', endpoint: cleanEndpoint });

      const normalized: NormalizedApiResponse<T> = {
        success: false,
        status: 401,
        error: {
          code: 'MISSING_API_KEY',
          message: errorMsg,
        },
        raw: { error: errorMsg },
        durationMs,
        requestId,
      };

      await this.logRepo.create({
        provider: 'paygo',
        endpoint: cleanEndpoint,
        method,
        requestId,
        httpStatus: 401,
        durationMs,
        success: false,
        sanitizedRequest: safeJsonStringify({ url, method, body: options.body }),
        sanitizedResponse: safeJsonStringify(normalized.raw),
        errorCode: 'MISSING_API_KEY',
      });

      return normalized;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, options.customTimeoutMs || this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      ...options.headers,
    };

    let httpStatus = 0;
    let rawResponseText = '';
    let parsedData: any = null;
    let success = false;
    let errorCode: string | undefined = undefined;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      httpStatus = response.status;
      rawResponseText = await response.text();

      // Safely parse JSON
      try {
        parsedData = rawResponseText ? JSON.parse(rawResponseText) : {};
      } catch {
        parsedData = { rawText: rawResponseText };
      }

      success = response.ok;
      if (!success) {
        errorCode = `HTTP_${httpStatus}`;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const isAbort = err.name === 'AbortError';
      httpStatus = isAbort ? 408 : 500;
      errorCode = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
      rawResponseText = JSON.stringify({
        error: isAbort ? 'Request timed out' : err.message,
        isNetworkError: true,
      });
      parsedData = { error: isAbort ? 'Request timed out' : err.message };
    }

    const durationMs = Date.now() - startTime;

    logger.info(`PayGo ${method} ${cleanEndpoint} completed`, {
      requestId,
      operation: 'paygo_api_call',
      endpoint: cleanEndpoint,
      method,
      paygoStatus: httpStatus,
      durationMs,
    });

    const normalized: NormalizedApiResponse<T> = {
      success,
      status: httpStatus,
      data: success ? parsedData : undefined,
      error: !success
        ? {
            code: errorCode,
            message: parsedData?.message || parsedData?.error || `HTTP Error ${httpStatus}`,
            details: parsedData,
          }
        : undefined,
      raw: parsedData,
      durationMs,
      requestId,
    };

    // Save to request log repo (redacted, sanitized)
    await this.logRepo.create({
      provider: 'paygo',
      endpoint: cleanEndpoint,
      method,
      requestId,
      httpStatus,
      durationMs,
      success,
      sanitizedRequest: safeJsonStringify({
        url,
        method,
        body: options.body,
      }),
      sanitizedResponse: safeJsonStringify(parsedData),
      errorCode: errorCode || null,
    });

    return normalized;
  }

  // --- API Methods ---

  async createProduct(input: CreateProductInput) {
    return this.request('/products', {
      method: 'POST',
      body: input,
    });
  }

  async listProducts() {
    return this.request('/products', {
      method: 'GET',
    });
  }

  async createPayment(input: CreatePaymentInput) {
    // Note: Caller must handle idempotency! We never auto-retry POST /payments blindly on network timeout.
    const paygoInput = { ...input };
    delete paygoInput.idempotency_key;
    delete paygoInput.confirmed_live;

    return this.request('/payments', {
      method: 'POST',
      body: paygoInput,
    });
  }

  async getPaymentStatus(paymentId: string) {
    return this.request(`/payment-status/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
    });
  }

  async createCheckoutLink(input: { product_id: string }) {
    return this.request('/checkout-links', {
      method: 'POST',
      body: input,
    });
  }

  async listSales() {
    return this.request('/sales', {
      method: 'GET',
    });
  }
}

export const payGoClient = new PayGoClient();
