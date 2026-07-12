import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientPaymentStatus,
  Currency,
  NotificationType,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentGatewayFactory } from './payment-gateway.factory';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: PaymentGatewayFactory,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Client initializes an escrow payment for their accepted delivery. Creates a
   * pending payment_in ledger row and returns the hosted-checkout URL.
   */
  async initialize(clientId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (delivery.order.clientId !== clientId) {
      throw new ForbiddenException('You do not own this delivery.');
    }
    if (delivery.clientPaymentStatus !== ClientPaymentStatus.pending) {
      throw new BadRequestException(
        `Payment already ${delivery.clientPaymentStatus} for this delivery.`,
      );
    }
    if (!delivery.basePrice) {
      throw new BadRequestException('Delivery has no price to charge.');
    }

    const client = await this.prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    const config = await this.prisma.countryConfig.findUniqueOrThrow({
      where: { countryCode: client.countryCode },
    });
    const gateway = this.gateways.forCountry(client.countryCode);
    const reference = this.newReference();
    const amount = new Prisma.Decimal(delivery.basePrice);

    // Ledger row first (pending), so a webhook that races us finds it.
    const tx = await this.ledger.record({
      userId: clientId,
      deliveryId,
      type: TransactionType.payment_in,
      amount,
      currency: config.currencyCode,
      status: TransactionStatus.pending,
      reference,
      metadata: { deliveryId, gateway: gateway.name },
      processedAt: null,
    });

    const init = await gateway.initialize({
      amount,
      currency: config.currencyCode,
      reference,
      customerEmail: client.email,
      customerPhone: client.phone,
      metadata: { deliveryId },
    });

    return {
      transactionId: tx.id,
      reference: init.reference,
      authorizationUrl: init.authorizationUrl,
      amount: Number(amount),
      currency: config.currencyCode,
      gateway: gateway.name,
    };
  }

  /** Client polls payment status; on success, moves funds into escrow. */
  async verify(clientId: string, reference: string) {
    const tx = await this.ledger.findByReference(reference);
    if (!tx || tx.userId !== clientId) {
      throw new NotFoundException('Payment not found.');
    }
    const client = await this.prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    const gateway = this.gateways.forCountry(client.countryCode);
    const result = await gateway.verify(reference);

    if (result.status === 'success') {
      await this.markEscrowHeld(reference, result.paymentMethod);
    }
    return { reference, status: result.status };
  }

  /**
   * Gateway webhook. Idempotent: a repeated success for an already-held payment
   * is a no-op. Returns quietly for unknown references (avoids leaking data).
   */
  async handleWebhook(provider: string, rawBody: string, signature: string | undefined) {
    const gateway = this.gateways.byName(provider);
    const result = gateway.parseWebhook(rawBody, signature);

    const tx = await this.ledger.findByReference(result.reference);
    if (!tx) {
      this.logger.warn(`Webhook for unknown reference ${result.reference} (${provider}).`);
      return { received: true };
    }
    if (result.status === 'success' && tx.status !== TransactionStatus.completed) {
      await this.markEscrowHeld(result.reference);
    } else if (result.status === 'failed' && tx.status === TransactionStatus.pending) {
      await this.ledger.markStatus(tx.id, TransactionStatus.failed);
    }
    return { received: true };
  }

  /**
   * Admin refund of a held escrow (litigation resolved for the client).
   * Appends a refund ledger row and marks the delivery refunded.
   */
  async refund(deliveryId: string, adminId: string, reason?: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (delivery.clientPaymentStatus !== ClientPaymentStatus.escrow_held) {
      throw new BadRequestException('Only held escrow can be refunded.');
    }
    const country = await this.clientCurrencyCountry(delivery.order.clientId);
    const config = await this.prisma.countryConfig.findUniqueOrThrow({
      where: { countryCode: country },
    });

    return this.prisma.$transaction(async (t) => {
      await this.ledger.record(
        {
          userId: delivery.order.clientId,
          deliveryId,
          type: TransactionType.refund,
          amount: new Prisma.Decimal(delivery.basePrice ?? 0),
          currency: config.currencyCode,
          status: TransactionStatus.completed,
          metadata: { reason: reason ?? null, refundedBy: adminId },
        },
        t,
      );
      return t.delivery.update({
        where: { id: deliveryId },
        data: { clientPaymentStatus: ClientPaymentStatus.refunded, status: 'cancelled' },
      });
    });
  }

  /**
   * Dev-only: simulate a gateway completing (or failing) a payment, so the full
   * escrow flow can be exercised without real provider callbacks. Wired to
   * POST /payments/mock/complete/:reference.
   */
  async completeMock(reference: string, success = true) {
    const tx = await this.ledger.findByReference(reference);
    if (!tx) {
      throw new NotFoundException('Payment not found.');
    }
    if (success) {
      await this.markEscrowHeld(reference, 'momo');
    } else if (tx.status === TransactionStatus.pending) {
      await this.ledger.markStatus(tx.id, TransactionStatus.failed);
    }
    return { reference, status: success ? 'success' : 'failed' };
  }

  // --- internals ----------------------------------------------------------

  private async markEscrowHeld(reference: string, paymentMethod?: string): Promise<void> {
    await this.prisma.$transaction(async (t) => {
      const tx = await t.transaction.findUnique({ where: { reference } });
      if (!tx || tx.status === TransactionStatus.completed) {
        return; // idempotent
      }
      await t.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.completed,
          processedAt: new Date(),
          paymentMethod: this.mapMethod(paymentMethod),
        },
      });
      if (tx.deliveryId) {
        await t.delivery.update({
          where: { id: tx.deliveryId },
          data: { clientPaymentStatus: ClientPaymentStatus.escrow_held },
        });
      }
    });

    // Notify participants (best-effort, outside the transaction).
    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
      include: { delivery: { include: { order: true } } },
    });
    if (tx?.delivery) {
      await this.notifications.notify(tx.delivery.order.clientId, {
        type: NotificationType.payment,
        title: 'Payment secured',
        body: 'Your payment is held in escrow until the delivery is completed.',
        data: { deliveryId: tx.delivery.id },
      });
      await this.notifications.notify(tx.delivery.livreurId, {
        type: NotificationType.payment,
        title: 'Payment secured',
        body: 'The client has paid. You can proceed with the delivery.',
        data: { deliveryId: tx.delivery.id },
      });
    }
  }

  private async clientCurrencyCountry(clientId: string) {
    const c = await this.prisma.user.findUniqueOrThrow({
      where: { id: clientId },
      select: { countryCode: true },
    });
    return c.countryCode;
  }

  private mapMethod(method?: string) {
    if (!method) return null;
    const m = method.toLowerCase();
    if (m.includes('mobile') || m.includes('momo')) return 'momo' as const;
    if (m.includes('card')) return 'card' as const;
    if (m.includes('bank')) return 'bank_transfer' as const;
    return null;
  }

  private newReference(): string {
    return `KAYA-${Date.now()}-${randomBytes(6).toString('hex')}`;
  }
}
