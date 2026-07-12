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
 * Kkiapay gateway (Togo/Benin, XOF). Kkiapay is widget-driven, so `initialize`
 * returns a hosted checkout URL carrying the public key + reference; `verify`
 * calls the transaction-status API; webhooks are HMAC-verified with the secret.
 * A structurally-complete placeholder per the blueprint (real keys wired later);
 * only instantiated when a private key is configured.
 */
@Injectable()
export class KkiapayGateway implements PaymentGateway {
  readonly name = 'kkiapay';
  private readonly apiBase = 'https://api.kkiapay.me/api/v1';
  private readonly checkoutBase = 'https://widget.kkiapay.me/checkout';

  constructor(private readonly config: AppConfigService) {}

  async initialize(input: PaymentInitInput): Promise<PaymentInitResult> {
    const params = new URLSearchParams({
      amount: input.amount.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toString(),
      key: this.config.get('KKIAPAY_PUBLIC_KEY'),
      reference: input.reference,
      sandbox: this.config.get('KKIAPAY_PUBLIC_KEY').startsWith('test') ? 'true' : 'false',
    });
    return {
      authorizationUrl: `${this.checkoutBase}?${params.toString()}`,
      reference: input.reference,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.apiBase}/transactions/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.get('KKIAPAY_PUBLIC_KEY'),
        'x-private-key': this.config.get('KKIAPAY_PRIVATE_KEY'),
        'x-secret-key': this.config.get('KKIAPAY_SECRET'),
      },
      body: JSON.stringify({ transactionId: reference }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as KkiapayStatusResponse;
    if (!body.status) {
      throw new InternalServerErrorException('Kkiapay verify failed.');
    }
    return {
      status: this.mapStatus(body.status),
      amount: new Prisma.Decimal(body.amount ?? 0),
      currency: 'XOF',
      providerReference: body.transactionId,
      paymentMethod: body.source,
    };
  }

  parseWebhook(rawBody: string, signature: string | undefined): WebhookResult {
    const secret = this.config.get('KKIAPAY_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signature || !this.safeEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid Kkiapay webhook signature.');
    }
    const body = JSON.parse(rawBody) as KkiapayWebhook;
    return {
      event: body.event ?? 'payment.success',
      reference: body.transactionId ?? body.reference ?? '',
      status: this.mapStatus(body.status),
      amount: body.amount != null ? new Prisma.Decimal(body.amount) : undefined,
      providerReference: body.transactionId,
    };
  }

  private mapStatus(status?: string): PaymentStatus {
    const s = (status ?? '').toUpperCase();
    if (s === 'SUCCESS') return 'success';
    if (s === 'FAILED' || s === 'INSUFFICIENT_FUNDS') return 'failed';
    return 'pending';
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}

interface KkiapayStatusResponse {
  status?: string;
  amount?: number;
  transactionId?: string;
  source?: string;
}
interface KkiapayWebhook {
  event?: string;
  status?: string;
  amount?: number;
  transactionId?: string;
  reference?: string;
}
