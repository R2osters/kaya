import { Prisma } from '@prisma/client';

/** Injection token for the payment gateway factory. */
export const PAYMENT_GATEWAY_FACTORY = 'PAYMENT_GATEWAY_FACTORY';

export type PaymentStatus = 'success' | 'pending' | 'failed';

export interface PaymentInitInput {
  amount: Prisma.Decimal;
  currency: string;
  reference: string;
  customerEmail: string;
  customerPhone?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  /** URL the client opens to pay (hosted checkout). */
  authorizationUrl: string;
  reference: string;
  providerReference?: string;
}

export interface PaymentVerifyResult {
  status: PaymentStatus;
  amount: Prisma.Decimal;
  currency: string;
  providerReference?: string;
  paymentMethod?: string;
}

export interface WebhookResult {
  event: string;
  reference: string;
  status: PaymentStatus;
  amount?: Prisma.Decimal;
  providerReference?: string;
}

/**
 * Payment gateway abstraction (escrow-style: money is captured to the platform,
 * released to the driver after delivery). Implemented by a keyless mock (dev),
 * Paystack (Ghana) and Kkiapay (Togo/Benin). All money is Decimal.
 */
export interface PaymentGateway {
  readonly name: string;
  initialize(input: PaymentInitInput): Promise<PaymentInitResult>;
  verify(reference: string): Promise<PaymentVerifyResult>;
  /** Validates and parses a webhook payload; throws on an invalid signature. */
  parseWebhook(rawBody: string, signature: string | undefined): WebhookResult;
}
