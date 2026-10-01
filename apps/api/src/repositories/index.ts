import { PrismaProductRepository } from './product.repository.js';
import { PrismaPaymentRepository } from './payment.repository.js';
import { PrismaWebhookEventRepository } from './webhook-event.repository.js';
import { PrismaRequestLogRepository } from './request-log.repository.js';

export * from './types.js';
export * from './product.repository.js';
export * from './payment.repository.js';
export * from './webhook-event.repository.js';
export * from './request-log.repository.js';

export const productRepository = new PrismaProductRepository();
export const paymentRepository = new PrismaPaymentRepository();
export const webhookEventRepository = new PrismaWebhookEventRepository();
export const requestLogRepository = new PrismaRequestLogRepository();
