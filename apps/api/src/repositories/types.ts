import { InternalPaymentStatus, PaymentMethod } from '@paygo/shared';

export interface TestProductData {
  id: string;
  paygoProductId: string;
  name: string;
  price: number;
  paymentMulticaixa: boolean;
  paymentReference: boolean;
  paymentStripe: boolean;
  createdAt: Date;
}

export interface TestPaymentData {
  id: string;
  paygoPaymentId?: string | null;
  testProductId?: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  status: InternalPaymentStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  idempotencyKey: string;
  itemsJson?: string | null;
  rawPaygoResponse?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface WebhookEventData {
  id: string;
  provider: string;
  signature: string;
  signatureValid: boolean;
  eventHash: string;
  payload: string;
  processed: boolean;
  processingError?: string | null;
  paymentId?: string | null;
  createdAt: Date;
  processedAt?: Date | null;
}
