import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyResult,
  WebhookResult,
} from '../payment-gateway.interface';

/**
 * Keyless mock gateway for dev/demo. `initialize` returns a fake hosted-checkout
 * URL; `verify` always reports success; `parseWebhook` trusts the JSON body.
 * Lets the full escrow flow run end-to-end without any provider credentials.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';
  private readonly logger = new Logger('Payments');

  async initialize(input: PaymentInitInput): Promise<PaymentInitResult> {
    this.logger.warn(
      `[MOCK PAY] initialize ${input.reference} ${input.amount.toFixed(2)} ${input.currency}`,
    );
    return {
      authorizationUrl: `https://mock-pay.local/checkout/${input.reference}`,
      reference: input.reference,
      providerReference: `mock_${input.reference}`,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    return {
      status: 'success',
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
