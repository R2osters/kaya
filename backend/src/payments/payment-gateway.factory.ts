import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CountryCode } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PaymentGateway } from './payment-gateway.interface';
import { MockPaymentGateway } from './providers/mock-payment.gateway';
import { PaystackGateway } from './providers/paystack.gateway';
import { KkiapayGateway } from './providers/kkiapay.gateway';

/**
 * Chooses the payment gateway per country (Ghana -> Paystack, Togo/Benin ->
 * Kkiapay) when credentials are configured, otherwise the keyless mock so the
 * escrow flow always works in dev/demo.
 */
@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly mock: MockPaymentGateway,
    private readonly paystack: PaystackGateway,
    private readonly kkiapay: KkiapayGateway,
  ) {}

  forCountry(country: CountryCode): PaymentGateway {
    if (country === CountryCode.GHA) {
      return this.config.get('PAYSTACK_SECRET_KEY') ? this.paystack : this.mock;
    }
    // Togo & Benin
    return this.config.get('KKIAPAY_PRIVATE_KEY') ? this.kkiapay : this.mock;
  }

  /** Resolve a gateway by name for webhook routing (/payments/webhook/:provider). */
  byName(name: string): PaymentGateway {
    switch (name) {
      case 'paystack':
        return this.config.get('PAYSTACK_SECRET_KEY') ? this.paystack : this.mock;
      case 'kkiapay':
        return this.config.get('KKIAPAY_PRIVATE_KEY') ? this.kkiapay : this.mock;
      case 'mock':
        return this.mock;
      default:
        throw new NotFoundException(`Unknown payment provider "${name}".`);
    }
  }
}
