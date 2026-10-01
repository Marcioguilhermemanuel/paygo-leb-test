import { InternalPaymentStatus, PAYMENT_STATUSES } from './constants.js';

export interface StateTransitionResult {
  valid: boolean;
  from: InternalPaymentStatus;
  to: InternalPaymentStatus;
  reason?: string;
}

const ALLOWED_TRANSITIONS: Record<InternalPaymentStatus, InternalPaymentStatus[]> = {
  [PAYMENT_STATUSES.CREATED]: [
    PAYMENT_STATUSES.PENDING,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED,
  ],
  [PAYMENT_STATUSES.PENDING]: [
    PAYMENT_STATUSES.COMPLETED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.AMOUNT_MISMATCH,
    PAYMENT_STATUSES.UNKNOWN,
  ],
  [PAYMENT_STATUSES.COMPLETED]: [], // Terminal state by default
  [PAYMENT_STATUSES.FAILED]: [],    // Terminal state by default
  [PAYMENT_STATUSES.CANCELLED]: [], // Terminal state by default
  [PAYMENT_STATUSES.UNKNOWN]: [
    PAYMENT_STATUSES.PENDING,
    PAYMENT_STATUSES.COMPLETED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED,
  ],
  [PAYMENT_STATUSES.AMOUNT_MISMATCH]: [
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED,
  ],
};

export function canTransitionPaymentState(
  from: InternalPaymentStatus,
  to: InternalPaymentStatus
): StateTransitionResult {
  // Same state is always a no-op / valid idempotency
  if (from === to) {
    return {
      valid: true,
      from,
      to,
      reason: 'State unchanged (idempotent)',
    };
  }

  const allowedNext = ALLOWED_TRANSITIONS[from] || [];
  const isValid = allowedNext.includes(to);

  return {
    valid: isValid,
    from,
    to,
    reason: isValid
      ? 'Transition allowed'
      : `Illegal transition from ${from} to ${to}. Expected one of: [${allowedNext.join(', ')}]`,
  };
}
