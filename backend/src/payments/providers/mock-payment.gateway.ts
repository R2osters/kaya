import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyResult,
  WebhookResult,
} from '../payment-gateway.interface';

/**
 * Keyless mock gateway for dev/demo. `initialize` points at the checkout page
 * *this backend serves* (GET /payments/mock/checkout/:reference) -- an earlier
 * version returned `https://mock-pay.local/...`, which looked plausible in
 * unit tests and was a blank tab the first time a phone actually opened it.
 * `verify` reads the ledger, so a checkout abandoned on the mock page stays
 * pending instead of turning into a phantom success.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';
  private readonly logger = new Logger('Payments');

  constructor(private readonly prisma: PrismaService) {}

  async initialize(input: PaymentInitInput): Promise<PaymentInitResult> {
    this.logger.warn(
      `[MOCK PAY] initialize ${input.reference} ${input.amount.toFixed(2)} ${input.currency}`,
    );
    const base = input.publicBaseUrl ?? 'http://localhost:3000';
    const redirect =
      input.callbackUrl === undefined ? '' : `?redirect=${encodeURIComponent(input.callbackUrl)}`;
    return {
      authorizationUrl: `${base}/api/v1/payments/mock/checkout/${input.reference}${redirect}`,
      reference: input.reference,
      providerReference: `mock_${input.reference}`,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    // A real gateway is asked what happened; the mock's source of truth is the
    // ledger row that the checkout page's complete call updated. Answering
    // 'success' unconditionally (as the first version did) let a payment the
    // user explicitly failed on the mock page be flipped to escrow_held by the
    // verify that followed.
    const tx = await this.prisma.transaction.findUnique({ where: { reference } });
    const status =
      tx?.status === TransactionStatus.completed
        ? 'success'
        : tx?.status === TransactionStatus.failed
          ? 'failed'
          : 'pending';
    return {
      status,
      amount: new Prisma.Decimal(0), // amount is authoritative from our own record
      currency: 'GHS',
      providerReference: `mock_${reference}`,
      paymentMethod: 'momo',
    };
  }

  parseWebhook(rawBody: string): WebhookResult {
    const body = JSON.parse(rawBody) as {
      event?: string;
      reference?: string;
      data?: { reference?: string; status?: string; amount?: number };
      status?: string;
      amount?: number;
    };
    const reference = body.reference ?? body.data?.reference ?? '';
    const rawStatus = body.status ?? body.data?.status ?? 'success';
    const amount = body.amount ?? body.data?.amount;
    return {
      event: body.event ?? 'charge.success',
      reference,
      status: rawStatus === 'success' || rawStatus === 'successful' ? 'success' : 'pending',
      amount: amount != null ? new Prisma.Decimal(amount) : undefined,
    };
  }
}
