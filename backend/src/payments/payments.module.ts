import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { MockPaymentGateway } from './providers/mock-payment.gateway';
import { PaystackGateway } from './providers/paystack.gateway';
import { KkiapayGateway } from './providers/kkiapay.gateway';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentGatewayFactory,
    MockPaymentGateway,
    PaystackGateway,
    KkiapayGateway,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
