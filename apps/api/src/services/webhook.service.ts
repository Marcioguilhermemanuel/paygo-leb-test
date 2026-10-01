import {
  InternalPaymentStatus,
  PAYMENT_STATUSES,
  PAYGO_EXTERNAL_STATUSES,
  canTransitionPaymentState,
  safeJsonStringify,
} from '@paygo/shared';
import { env } from '../config/env.js';
import { verifyWebhookSignature, computeEventHash } from '../lib/hmac.js';
import {
  IWebhookEventRepository,
  webhookEventRepository,
  IPaymentRepository,
  paymentRepository,
  WebhookEventData,
} from '../repositories/index.js';
import { logger } from '../lib/logger.js';

export interface WebhookProcessResult {
  success: boolean;
  status: number;
  message: string;
  duplicate?: boolean;
  event?: WebhookEventData;
  paymentId?: string;
  error?: string;
}

export class WebhookService {
  constructor(
    private webhookRepo: IWebhookEventRepository = webhookEventRepository,
    private paymentRepo: IPaymentRepository = paymentRepository
  ) {}

  async processWebhook(
    rawBody: string | Buffer,
    signatureHeader: string | null | undefined
  ): Promise<WebhookProcessResult> {
    const rawBodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const eventHash = computeEventHash(rawBodyString);
    const signature = signatureHeader || '';

    // 1. Verify HMAC Signature
    const verification = verifyWebhookSignature(
      rawBodyString,
      signature,
      env.PAYGO_WEBHOOK_SECRET
    );

    if (!verification.isValid) {
      logger.warn('Rejected webhook with invalid HMAC signature', {
        operation: 'webhook_rejected',
        reason: verification.reason,
        providedSignature: signature ? '[REDACTED_FORMAT_PRESENT]' : '[NONE]',
      });

      // Record invalid event for security audit
      const recorded = await this.webhookRepo.create({
        provider: 'paygo',
        signature: signature || '[MISSING]',
        signatureValid: false,
        eventHash,
        payload: rawBodyString,
        processed: false,
        processingError: verification.reason || 'Invalid signature',
      });

      return {
        success: false,
        status: 401,
        message: 'Invalid webhook signature',
        event: recorded,
      };
    }

    // 2. Check for duplicate/replay event
    const existing = await this.webhookRepo.findByEventHash(eventHash);
    if (existing && existing.processed) {
      logger.info('Duplicate webhook event detected and skipped (idempotent)', {
        operation: 'webhook_duplicate',
        eventHash,
        eventId: existing.id,
      });

      // Record receipt of duplicate for tracking
      await this.webhookRepo.create({
        provider: 'paygo',
        signature,
        signatureValid: true,
        eventHash,
        payload: rawBodyString,
        processed: true,
        processingError: 'Duplicate event payload',
        paymentId: existing.paymentId,
      });

      return {
        success: true,
        status: 200,
        message: 'Duplicate event acknowledged',
        duplicate: true,
        event: existing,
      };
    }

    // 3. Record valid event
    const event = await this.webhookRepo.create({
      provider: 'paygo',
      signature,
      signatureValid: true,
      eventHash,
      payload: rawBodyString,
      processed: false,
    });

    // 4. Parse payload
    let payloadJson: any;
    try {
      payloadJson = JSON.parse(rawBodyString);
    } catch (parseError: any) {
      await this.webhookRepo.markProcessed(event.id, undefined, 'Invalid JSON body');
      return {
        success: false,
        status: 400,
        message: 'Malformed JSON payload',
        event,
      };
    }

    // PayGo webhook payload may contain payment_id or id or data.payment_id
    const paygoPaymentId =
      payloadJson.payment_id ||
      payloadJson.id ||
      payloadJson.data?.payment_id ||
      payloadJson.data?.id;

    if (!paygoPaymentId) {
      logger.warn('Webhook payload does not contain identifiable payment ID', {
        payload: payloadJson,
      });
      await this.webhookRepo.markProcessed(event.id, undefined, 'Missing payment identifier in payload');
      return {
        success: true,
        status: 200,
        message: 'Webhook received but no payment ID identified',
        event,
      };
    }

    // 5. Look up matching payment
    const payment = await this.paymentRepo.findByPaygoId(String(paygoPaymentId));
    if (!payment) {
      logger.warn(`Webhook received for unknown PayGo payment ID: ${paygoPaymentId}`);
      await this.webhookRepo.markProcessed(
        event.id,
        undefined,
        `No local payment found with PayGo ID ${paygoPaymentId}`
      );
      return {
        success: true,
        status: 200,
        message: 'Webhook received for unknown local payment',
        event,
      };
    }

    // 6. Map status
    const incomingStatus = String(
      payloadJson.status || payloadJson.data?.status || ''
    ).toLowerCase();

    let targetStatus: InternalPaymentStatus = PAYMENT_STATUSES.UNKNOWN;
    if (incomingStatus === PAYGO_EXTERNAL_STATUSES.COMPLETED) {
      targetStatus = PAYMENT_STATUSES.COMPLETED;
    } else if (incomingStatus === PAYGO_EXTERNAL_STATUSES.PENDING) {
      targetStatus = PAYMENT_STATUSES.PENDING;
    } else if (incomingStatus === PAYGO_EXTERNAL_STATUSES.FAILED) {
      targetStatus = PAYMENT_STATUSES.FAILED;
    } else if (incomingStatus === PAYGO_EXTERNAL_STATUSES.CANCELLED) {
      targetStatus = PAYMENT_STATUSES.CANCELLED;
    }

    // 7. Verify Amount
    const webhookAmount = Number(payloadJson.amount || payloadJson.data?.amount);
    if (!isNaN(webhookAmount) && webhookAmount > 0 && payment.amount > 0) {
      if (Math.abs(webhookAmount - payment.amount) > 0.01) {
        logger.warn('Amount mismatch detected in webhook notification', {
          paymentId: payment.id,
          expected: payment.amount,
          webhookAmount,
        });
        if (targetStatus === PAYMENT_STATUSES.COMPLETED) {
          targetStatus = PAYMENT_STATUSES.AMOUNT_MISMATCH;
        }
      }
    }

    // 8. Validate state transition
    const transition = canTransitionPaymentState(payment.status, targetStatus);
    if (!transition.valid) {
      logger.warn(`Illegal state transition attempt via webhook rejected: ${transition.reason}`, {
        paymentId: payment.id,
        currentStatus: payment.status,
        targetStatus,
      });

      await this.webhookRepo.markProcessed(
        event.id,
        payment.id,
        `Transition rejected: ${transition.reason}`
      );

      return {
        success: true,
        status: 200,
        message: `Webhook accepted but transition rejected: ${transition.reason}`,
        event,
        paymentId: payment.id,
      };
    }

    // 9. Update payment in DB
    const updateData: Partial<typeof payment> = {
      status: targetStatus,
      rawPaygoResponse: safeJsonStringify({
        lastWebhook: payloadJson,
      }),
    };

    if (targetStatus === PAYMENT_STATUSES.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (targetStatus === PAYMENT_STATUSES.FAILED) {
      updateData.failedAt = new Date();
    } else if (targetStatus === PAYMENT_STATUSES.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    await this.paymentRepo.update(payment.id, updateData);
    const completedEvent = await this.webhookRepo.markProcessed(event.id, payment.id);

    logger.info(`Payment ${payment.id} successfully updated to ${targetStatus} via webhook`, {
      operation: 'webhook_applied',
      paymentId: payment.id,
      newStatus: targetStatus,
    });

    return {
      success: true,
      status: 200,
      message: `Payment updated to ${targetStatus}`,
      event: completedEvent,
      paymentId: payment.id,
    };
  }

  async listEvents(limit = 100): Promise<WebhookEventData[]> {
    return this.webhookRepo.list(limit);
  }

  async getStats() {
    return this.webhookRepo.getStats();
  }
}

export const webhookService = new WebhookService();
