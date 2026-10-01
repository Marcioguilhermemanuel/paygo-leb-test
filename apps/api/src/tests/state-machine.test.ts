import { describe, it, expect } from 'vitest';
import { canTransitionPaymentState, PAYMENT_STATUSES } from '@paygo/shared';

describe('Payment State Machine Unit Tests', () => {
  it('allows valid normal life-cycle transitions', () => {
    // CREATED -> PENDING
    expect(
      canTransitionPaymentState(PAYMENT_STATUSES.CREATED, PAYMENT_STATUSES.PENDING).valid
    ).toBe(true);

    // PENDING -> COMPLETED
    expect(
      canTransitionPaymentState(PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.COMPLETED).valid
    ).toBe(true);

    // PENDING -> FAILED
    expect(
      canTransitionPaymentState(PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.FAILED).valid
    ).toBe(true);

    // PENDING -> CANCELLED
    expect(
      canTransitionPaymentState(PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.CANCELLED).valid
    ).toBe(true);
  });

  it('rejects arbitrary backwards transitions from COMPLETED', () => {
    // COMPLETED -> PENDING (blocked)
    const toPending = canTransitionPaymentState(
      PAYMENT_STATUSES.COMPLETED,
      PAYMENT_STATUSES.PENDING
    );
    expect(toPending.valid).toBe(false);
    expect(toPending.reason).toContain('Illegal transition');

    // COMPLETED -> FAILED (blocked)
    const toFailed = canTransitionPaymentState(
      PAYMENT_STATUSES.COMPLETED,
      PAYMENT_STATUSES.FAILED
    );
    expect(toFailed.valid).toBe(false);
  });

  it('allows self-transition as idempotent no-op', () => {
    const idempotentCompleted = canTransitionPaymentState(
      PAYMENT_STATUSES.COMPLETED,
      PAYMENT_STATUSES.COMPLETED
    );
    expect(idempotentCompleted.valid).toBe(true);

    const idempotentPending = canTransitionPaymentState(
      PAYMENT_STATUSES.PENDING,
      PAYMENT_STATUSES.PENDING
    );
    expect(idempotentPending.valid).toBe(true);
  });
});
