import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentStatus,
  PaymentVerifyResult,
  WebhookResult,
} from '../payment-gateway.interface';

/**
 * Paystack gateway (Ghana). Amounts are sent in the currency subunit (pesewas).
 * Webhooks are verified with an HMAC-SHA512 of the raw body using the secret key
 * (Paystack's documented scheme). Only instantiated when a secret key is set.
 */
@Injectable()
export class PaystackGateway implements PaymentGateway {
  readonly name = 'paystack';
  private readonly base = 'https://api.paystack.co';

  constructor(private readonly config: AppConfigService) {}

  private get secret(): string {
    return this.config.get('PAYSTACK_SECRET_KEY');
  }

  async initialize(input: PaymentInitInput): Promise<PaymentInitResult> {
    const res = await fetch(`${this.base}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.customerEmail,
        amount: this.toSubunit(input.amount),
        currency: input.currency,
        reference: input.reference,
        metadata: input.metadata,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as PaystackInitResponse;
    if (!body.status || !body.data) {
      throw new InternalServerErrorException(`Paystack initialize failed: ${body.message}`);
    }
    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
      providerReference: body.data.access_code,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.base}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as PaystackVerifyResponse;
    if (!body.status || !body.data) {
      throw new InternalServerErrorException(`Paystack verify failed: ${body.message}`);
    }
    return {
      status: this.mapStatus(body.data.status),
      amount: this.fromSubunit(body.data.amount),
      currency: body.data.currency,
      providerReference: body.data.id?.toString(),
      paymentMethod: body.data.channel,
    };
  }

  parseWebhook(rawBody: string, signature: string | undefined): WebhookResult {
    const expected = createHmac('sha512', this.secret).update(rawBody).digest('hex');
    if (!signature || !this.safeEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature.');
    }
    const body = JSON.parse(rawBody) as PaystackWebhook;
    return {
      event: body.event,
      reference: body.data.reference,
      status: body.event === 'charge.success' ? 'success' : this.mapStatus(body.data.status),
      amount: body.data.amount != null ? this.fromSubunit(body.data.amount) : undefined,
      providerReference: body.data.id?.toString(),
    };
  }

  private toSubunit(amount: Prisma.Decimal): number {
    return amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }

  private fromSubunit(subunit: number): Prisma.Decimal {
    return new Prisma.Decimal(subunit).div(100);
  }

  private mapStatus(status?: string): PaymentStatus {
    if (status === 'success') return 'success';
    if (status === 'failed' || status === 'abandoned') return 'failed';
    return 'pending';
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
}
interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: { status: string; amount: number; currency: string; id?: number; channel?: string };
}
interface PaystackWebhook {
  event: string;
  data: { reference: string; status?: string; amount?: number; id?: number };
}
