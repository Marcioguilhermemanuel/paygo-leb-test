import crypto from 'node:crypto';
import {
  CreatePaymentInput,
  InternalPaymentStatus,
  PAYMENT_STATUSES,
  PAYGO_EXTERNAL_STATUSES,
  canTransitionPaymentState,
  safeJsonStringify,
} from '@paygo/shared';
import { payGoClient, PayGoClient } from '../lib/paygo-client.js';
import {
  IPaymentRepository,
  paymentRepository,
  IProductRepository,
  productRepository,
  TestPaymentData,
} from '../repositories/index.js';
import { logger } from '../lib/logger.js';
import { isLiveMode } from '../config/env.js';

export interface CreatePaymentResult {
  success: boolean;
  payment?: TestPaymentData;
  isExistingIdempotent?: boolean;
  paygoResponse?: any;
  error?: string;
  errorCode?: string;
}

export interface StatusCheckResult {
  success: boolean;
  payment: TestPaymentData;
  previousStatus: InternalPaymentStatus;
  newStatus: InternalPaymentStatus;
  amountVerified: boolean;
  amountDifference?: {
    expected: number;
    received?: number;
  };
  transitionAllowed: boolean;
  transitionReason?: string;
  paygoRawResponse?: any;
  error?: string;
}

export class PaymentService {
  private inFlightRequests = new Map<string, Promise<CreatePaymentResult>>();

  constructor(
    private client: PayGoClient = payGoClient,
    private paymentRepo: IPaymentRepository = paymentRepository,
    private productRepo: IProductRepository = productRepository
  ) {}

  async createTestPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const idempotencyKey = input.idempotency_key || `idemp_${crypto.randomUUID()}`;

    // 1. In-flight race-condition protection (Mutex pattern for concurrent requests)
    if (this.inFlightRequests.has(idempotencyKey)) {
      logger.info('Awaiting in-flight duplicate request for idempotencyKey', {
        operation: 'in_flight_deduplication',
        idempotencyKey,
      });
      return this.inFlightRequests.get(idempotencyKey)!;
    }

    const executionPromise = this.executePaymentCreation(input, idempotencyKey);
    this.inFlightRequests.set(idempotencyKey, executionPromise);

    try {
      const result = await executionPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(idempotencyKey);
    }
  }

  private async executePaymentCreation(
    input: CreatePaymentInput,
    idempotencyKey: string
  ): Promise<CreatePaymentResult> {
    // 2. Check if payment already exists for this idempotency key in DB
    const existing = await this.paymentRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info('Returning existing payment for idempotencyKey', {
        operation: 'idempotent_replay',
        idempotencyKey,
        paymentId: existing.id,
      });
      return {
        success: true,
        payment: existing,
        isExistingIdempotent: true,
        paygoResponse: existing.rawPaygoResponse ? JSON.parse(existing.rawPaygoResponse) : null,
      };
    }

    // 3. Live mode safety check
    if (isLiveMode() && !input.confirmed_live) {
      return {
        success: false,
        error: 'Transação em modo LIVE requer confirmação explícita do operador.',
        errorCode: 'LIVE_CONFIRMATION_REQUIRED',
      };
    }

    // 4. Calculate total amount
    let calculatedAmount = 0;
    let localProductId: string | undefined;

    if (input.product_id) {
      const product = await this.productRepo.findByPaygoId(input.product_id);
      if (product) {
        localProductId = product.id;
        calculatedAmount = product.price;
      }
    } else if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        const product = await this.productRepo.findByPaygoId(item.product_id);
        const unitPrice = product ? product.price : 0;
        calculatedAmount += unitPrice * item.quantity;
      }
    }

    // 5. Register initial intent in CREATED state
    const initialPayment = await this.paymentRepo.create({
      testProductId: localProductId,
      paymentMethod: input.payment_method,
      amount: calculatedAmount,
      currency: 'AOA',
      status: PAYMENT_STATUSES.CREATED,
      customerName: input.customer_name,
      customerEmail: input.customer_email,
      customerPhone: input.customer_phone,
      idempotencyKey,
      itemsJson: input.items ? JSON.stringify(input.items) : null,
      rawPaygoResponse: null,
    });

    // 6. Call PayGo API
    logger.info('Dispatching payment creation to PayGo', {
      operation: 'dispatch_paygo_payment',
      paymentId: initialPayment.id,
      idempotencyKey,
    });

    const response = await this.client.createPayment(input);

    if (!response.success || !response.data) {
      // Record failure state
      const failed = await this.paymentRepo.update(initialPayment.id, {
        status: PAYMENT_STATUSES.FAILED,
        failedAt: new Date(),
        rawPaygoResponse: safeJsonStringify(response.raw),
      });

      return {
        success: false,
        payment: failed,
        paygoResponse: response.raw,
        error: response.error?.message || 'Failed to create payment on PayGo',
        errorCode: response.error?.code,
      };
    }

    // 7. Parse response and update payment state
    const paygoData = response.data;
    const paygoPaymentId =
      paygoData.id ||
      paygoData.payment_id ||
      paygoData.data?.id ||
      paygoData.data?.payment_id;

    const updatedPayment = await this.paymentRepo.update(initialPayment.id, {
      paygoPaymentId: paygoPaymentId ? String(paygoPaymentId) : undefined,
      status: PAYMENT_STATUSES.PENDING,
      rawPaygoResponse: safeJsonStringify(response.raw),
    });

    return {
      success: true,
      payment: updatedPayment,
      isExistingIdempotent: false,
      paygoResponse: response.raw,
    };
  }

  async checkPaymentStatus(id: string): Promise<StatusCheckResult> {
    const payment = await this.paymentRepo.findById(id);
    if (!payment) {
      throw new Error(`Payment with ID ${id} not found`);
    }

    const previousStatus = payment.status;

    if (!payment.paygoPaymentId) {
      return {
        success: false,
        payment,
        previousStatus,
        newStatus: previousStatus,
        amountVerified: false,
        transitionAllowed: true,
        error: 'Payment has no associated PayGo payment ID',
      };
    }

    const statusResponse = await this.client.getPaymentStatus(payment.paygoPaymentId);

    if (!statusResponse.success || !statusResponse.data) {
      return {
        success: false,
        payment,
        previousStatus,
        newStatus: previousStatus,
        amountVerified: false,
        transitionAllowed: true,
        paygoRawResponse: statusResponse.raw,
        error: statusResponse.error?.message || 'Failed to query payment status from PayGo',
      };
    }

    const data = statusResponse.data;
    const externalStatus = String(data.status || data.data?.status || '').toLowerCase();

    // Map external status to internal status
    let mappedStatus: InternalPaymentStatus = PAYMENT_STATUSES.UNKNOWN;
    if (externalStatus === PAYGO_EXTERNAL_STATUSES.PENDING) {
      mappedStatus = PAYMENT_STATUSES.PENDING;
    } else if (externalStatus === PAYGO_EXTERNAL_STATUSES.COMPLETED) {
      mappedStatus = PAYMENT_STATUSES.COMPLETED;
    } else if (externalStatus === PAYGO_EXTERNAL_STATUSES.FAILED) {
      mappedStatus = PAYMENT_STATUSES.FAILED;
    } else if (externalStatus === PAYGO_EXTERNAL_STATUSES.CANCELLED) {
      mappedStatus = PAYMENT_STATUSES.CANCELLED;
    }

    // Amount verification if completed
    let amountVerified = true;
    let amountDifference: { expected: number; received?: number } | undefined = undefined;

    const returnedAmount = Number(data.amount || data.data?.amount);
    if (!isNaN(returnedAmount) && returnedAmount > 0 && payment.amount > 0) {
      if (Math.abs(returnedAmount - payment.amount) > 0.01) {
        amountVerified = false;
        amountDifference = {
          expected: payment.amount,
          received: returnedAmount,
        };
        if (mappedStatus === PAYMENT_STATUSES.COMPLETED) {
          logger.warn('Amount mismatch detected for payment', {
            paymentId: payment.id,
            expected: payment.amount,
            received: returnedAmount,
          });
          mappedStatus = PAYMENT_STATUSES.AMOUNT_MISMATCH;
        }
      }
    }

    // Validate state transition
    const transition = canTransitionPaymentState(previousStatus, mappedStatus);
    let finalStatus = previousStatus;

    const updatePayload: Partial<TestPaymentData> = {
      rawPaygoResponse: safeJsonStringify(statusResponse.raw),
    };

    if (transition.valid) {
      finalStatus = mappedStatus;
      updatePayload.status = mappedStatus;
      if (mappedStatus === PAYMENT_STATUSES.COMPLETED) {
        updatePayload.completedAt = new Date();
      } else if (mappedStatus === PAYMENT_STATUSES.FAILED) {
        updatePayload.failedAt = new Date();
      } else if (mappedStatus === PAYMENT_STATUSES.CANCELLED) {
        updatePayload.cancelledAt = new Date();
      }
    } else {
      logger.warn(`Illegal state transition attempt rejected: ${transition.reason}`, {
        paymentId: payment.id,
        from: previousStatus,
        to: mappedStatus,
      });
    }

    const updated = await this.paymentRepo.update(payment.id, updatePayload);

    return {
      success: true,
      payment: updated,
      previousStatus,
      newStatus: finalStatus,
      amountVerified,
      amountDifference,
      transitionAllowed: transition.valid,
      transitionReason: transition.reason,
      paygoRawResponse: statusResponse.raw,
    };
  }

  async listPayments(limit = 100): Promise<TestPaymentData[]> {
    return this.paymentRepo.list(limit);
  }

  async getPayment(id: string): Promise<TestPaymentData | null> {
    return this.paymentRepo.findById(id);
  }
}

export const paymentService = new PaymentService();
