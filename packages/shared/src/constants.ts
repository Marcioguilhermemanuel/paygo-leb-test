export const DEFAULT_PAYGO_BASE_URL = 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';

export const PAYMENT_METHODS = {
  MULTICAIXA: 'multicaixa',
  REFERENCE: 'reference',
  STRIPE: 'stripe',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUSES = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  UNKNOWN: 'UNKNOWN',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
} as const;

export type InternalPaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const PAYGO_EXTERNAL_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type PayGoExternalStatus = (typeof PAYGO_EXTERNAL_STATUSES)[keyof typeof PAYGO_EXTERNAL_STATUSES];
