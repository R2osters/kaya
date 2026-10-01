import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientPaymentStatus,
  Delivery,
  DeliveryStatus,
  DriverPayoutStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionService } from '../commission/commission.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { localDayStartUtc } from '../common/country-timezone';

/**
 * What one participant may see of the other on a shared delivery.
 *
 * The two of them are meeting in person over a package, so a name to greet, a
 * face to recognise, a phone to call when the address is wrong, and a rating
 * to know who they are dealing with. Nothing else -- not the email, not the
 * balance, not the documents.
 *
 * It exists because `listForUser` and `findOne` included only `order`, so both
 * apps rendered `delivery.driver` (and, on this side, the client) as null on
 * every row: the client's inbox fell back to showing an address where a name
 * belongs, and the driver had no one to call. Nothing failed -- the field was
 * simply always absent.
 */
const PARTICIPANT_SELECT = {
  id: true,
  fullName: true,
  profilePhoto: true,
  phone: true,
  ratingDriver: true,
  ratingClient: true,
  totalDeliveries: true,
} as const;

/** Delivery with both participants attached, for participant-facing reads. */
const WITH_PARTICIPANTS = {
  order: { include: { client: { select: PARTICIPANT_SELECT } } },
  livreur: { select: PARTICIPANT_SELECT },
} as const;

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commission: CommissionService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async listForUser(user: AuthUser): Promise<Delivery[]> {
    return this.prisma.delivery.findMany({
      where: {
        OR: [{ livreurId: user.id }, { order: { clientId: user.id } }],
      },
      orderBy: { createdAt: 'desc' },
      include: WITH_PARTICIPANTS,
    });
  }

  async findOne(id: string, user: AuthUser): Promise<Delivery> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: WITH_PARTICIPANTS,
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (
      delivery.livreurId !== user.id &&
      delivery.order.clientId !== user.id &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('You are not a participant of this delivery.');
    }
    return delivery;
  }

  /** Step 2: driver starts heading to pickup. Requires escrow to be held. */
  async start(id: string, driverId: string): Promise<Delivery> {
    const delivery = await this.assertDriverDelivery(id, driverId);
    if (delivery.order.status !== OrderStatus.accepted) {
      throw new BadRequestException(`Cannot start from order status "${delivery.order.status}".`);
    }
    if (delivery.clientPaymentStatus !== ClientPaymentStatus.escrow_held) {
      throw new BadRequestException('Client payment is not secured in escrow yet.');
    }
    return this.transition(delivery.id, delivery.orderId, OrderStatus.driver_en_route, {
      startTime: new Date(),
    });
  }

  /** Step 3: driver picked up the package (optional photo). */
  async pickup(id: string, driverId: string, photoUrl?: string): Promise<Delivery> {
    const delivery = await this.assertDriverDelivery(id, driverId);
    if (delivery.order.status !== OrderStatus.driver_en_route) {
      throw new BadRequestException(`Cannot pick up from order status "${delivery.order.status}".`);
    }
    return this.transition(delivery.id, delivery.orderId, OrderStatus.picked_up, {
      pickupTime: new Date(),
      pickupPhoto: photoUrl ?? undefined,
      pickupPhotoTakenAt: photoUrl ? new Date() : undefined,
    });
  }

  /** Step 4: driver departs for the drop-off. */
  async transit(id: string, driverId: string): Promise<Delivery> {
    const delivery = await this.assertDriverDelivery(id, driverId);
    if (delivery.order.status !== OrderStatus.picked_up) {
      throw new BadRequestException(`Cannot go in transit from "${delivery.order.status}".`);
    }
    return this.transition(delivery.id, delivery.orderId, OrderStatus.in_transit, {});
  }

  /** Step 5: driver confirms delivery -> triggers escrow settlement. */
  async confirmDelivery(id: string, driverId: string, photoUrl?: string): Promise<Delivery> {
    const delivery = await this.assertDriverDelivery(id, driverId);
    if (delivery.order.status !== OrderStatus.in_transit) {
      throw new BadRequestException(`Cannot confirm delivery from "${delivery.order.status}".`);
    }
    await this.transition(delivery.id, delivery.orderId, OrderStatus.delivered, {
      deliveryTime: new Date(),
      deliveryConfirmedAt: new Date(),
      deliveryPhoto: photoUrl ?? undefined,
      status: DeliveryStatus.completed,
    });
    return this.settle(delivery.id);
  }

  async cancel(id: string, user: AuthUser, reason?: string): Promise<Delivery> {
    const delivery = await this.findOne(id, user);
    if (delivery.status !== DeliveryStatus.in_progress) {
      throw new BadRequestException('Only an in-progress delivery can be cancelled.');
    }
    // Cancellation is only allowed before pickup (order still accepted/en route).
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: delivery.orderId } });
    if (order.status !== OrderStatus.accepted && order.status !== OrderStatus.driver_en_route) {
      throw new BadRequestException('A delivery can no longer be cancelled after pickup.');
    }

    return this.prisma.$transaction(async (t) => {
      // Refund held escrow to the client if payment was captured.
      if (delivery.clientPaymentStatus === ClientPaymentStatus.escrow_held) {
        const order = await t.order.findUniqueOrThrow({ where: { id: delivery.orderId } });
        const client = await t.user.findUniqueOrThrow({ where: { id: order.clientId } });
        const config = await t.countryConfig.findUniqueOrThrow({
          where: { countryCode: client.countryCode },
        });
        const refundTx = await this.ledger.record(
          {
            userId: order.clientId,
            deliveryId: delivery.id,
            type: TransactionType.refund,
            amount: new Prisma.Decimal(delivery.basePrice ?? 0),
            currency: config.currencyCode,
            status: TransactionStatus.completed,
            metadata: { reason: reason ?? 'delivery cancelled' },
          },
          t,
        );
        this.logger.log(`Refund ${refundTx.id} issued for cancelled delivery ${delivery.id}.`);
      }

      await t.order.update({
        where: { id: delivery.orderId },
        data: { status: OrderStatus.cancelled, cancelReason: reason ?? null },
      });
      const updated = await t.delivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.cancelled,
          clientPaymentStatus:
            delivery.clientPaymentStatus === ClientPaymentStatus.escrow_held
              ? ClientPaymentStatus.refunded
              : delivery.clientPaymentStatus,
        },
      });
      this.realtime.emitDeliveryStatus(delivery.id, DeliveryStatus.cancelled);
      return updated;
    });
  }

  /**
   * A participant opens a dispute after pickup and before settlement. Freezes
   * the delivery in `disputed` (order + delivery) so escrow stays held until an
   * admin resolves it. Idempotent when already disputed.
   */
  async dispute(id: string, user: AuthUser, reason?: string): Promise<Delivery> {
    const delivery = await this.findOne(id, user); // participant/admin check
    if (delivery.status === DeliveryStatus.disputed) {
      return delivery;
    }
    if (delivery.driverPayoutStatus !== DriverPayoutStatus.pending) {
      throw new BadRequestException('This delivery is already settled and cannot be disputed.');
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: delivery.orderId } });
    const disputable: OrderStatus[] = [
      OrderStatus.picked_up,
      OrderStatus.in_transit,
      OrderStatus.delivered,
    ];
    if (!disputable.includes(order.status)) {
      throw new BadRequestException('A delivery can only be disputed after pickup.');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: OrderStatus.disputed, cancelReason: reason ?? null },
      }),
      this.prisma.delivery.update({ where: { id }, data: { status: DeliveryStatus.disputed } }),
    ]);
    this.realtime.emitDeliveryStatus(id, DeliveryStatus.disputed);
    await this.notifications.notify(order.clientId, {
      type: NotificationType.delivery,
      title: 'Dispute opened',
      body: 'A dispute was opened on this delivery. Our team will review it.',
      data: { deliveryId: id },
    });
    await this.notifications.notify(delivery.livreurId, {
      type: NotificationType.delivery,
      title: 'Dispute opened',
      body: 'A dispute was opened on this delivery. Payment is held pending review.',
      data: { deliveryId: id },
    });
    return updated;
  }

  /**
   * Escrow settlement (Architecture doc §4.4/§4.5). Atomically: increment the
   * driver's daily/total counters, compute degressive commission by the day's
   * delivery number, credit net earnings to the driver balance, append the four
   * ledger rows (escrow_release, commission, litigation_fee, driver_payout) and
   * the litigation-fund entry, and flip the payment/payout statuses.
   */
  async settle(deliveryId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (t) => {
      const delivery = await t.delivery.findUniqueOrThrow({
        where: { id: deliveryId },
        include: { order: true },
      });
      if (delivery.driverPayoutStatus !== DriverPayoutStatus.pending) {
        return delivery; // already settled - idempotent
      }
      if (delivery.clientPaymentStatus !== ClientPaymentStatus.escrow_held) {
        throw new BadRequestException('Cannot settle: escrow is not held.');
      }

      const driver = await t.user.findUniqueOrThrow({ where: { id: delivery.livreurId } });
      const config = await t.countryConfig.findUniqueOrThrow({
        where: { countryCode: driver.countryCode },
      });
      const basePrice = new Prisma.Decimal(delivery.basePrice ?? 0);

      // The tier is set by this delivery's ORDINAL within the driver's local day,
      // computed authoritatively from already-settled deliveries today (tz-aware),
      // independent of the daily_deliveries counter/reset cron.
      const dayStart = localDayStartUtc(driver.countryCode);
      const settledToday = await t.delivery.count({
        where: {
          livreurId: driver.id,
          driverPayoutStatus: DriverPayoutStatus.processed,
          deliveryTime: { gte: dayStart },
        },
      });
      const ordinal = settledToday + 1;

      // Keep the counters in sync for stats/next-tier display.
      await t.user.update({
        where: { id: driver.id },
        data: { dailyDeliveries: { increment: 1 }, totalDeliveries: { increment: 1 } },
      });
      const breakdown = this.commission.calculate(basePrice, ordinal, config);

      // Credit the driver's balance with net earnings.
      await t.user.update({
        where: { id: driver.id },
        data: { balance: { increment: breakdown.netEarnings } },
      });

      const currency = config.currencyCode;
      // Append-only ledger: escrow release, commission, litigation fee, payout.
      await this.ledger.record(
        {
          userId: driver.id,
          deliveryId,
          type: TransactionType.escrow_release,
          amount: basePrice,
          currency,
          status: TransactionStatus.completed,
        },
        t,
      );
      await this.ledger.record(
        {
          userId: driver.id,
          deliveryId,
          type: TransactionType.commission,
          amount: breakdown.commission,
          currency,
          status: TransactionStatus.completed,
          metadata: { rate: breakdown.rate.toString(), dayNumber: ordinal },
        },
        t,
      );
      const litigationTx = await this.ledger.record(
        {
          userId: driver.id,
          deliveryId,
          type: TransactionType.litigation_fee,
          amount: breakdown.litigationFee,
          currency,
          status: TransactionStatus.completed,
        },
        t,
      );
      await this.ledger.addLitigationEntry(
        {
          transactionId: litigationTx.id,
          amount: breakdown.litigationFee,
          description: `Litigation fee for delivery ${deliveryId}`,
        },
        t,
      );
      await this.ledger.record(
        {
          userId: driver.id,
          deliveryId,
          type: TransactionType.driver_payout,
          amount: breakdown.netEarnings,
          currency,
          status: TransactionStatus.completed,
        },
        t,
      );

      const settled = await t.delivery.update({
        where: { id: deliveryId },
        data: {
          commissionRate: breakdown.rate,
          commissionAmount: breakdown.commission,
          litigationFee: breakdown.litigationFee,
          netEarnings: breakdown.netEarnings,
          clientPaymentStatus: ClientPaymentStatus.released,
          driverPayoutStatus: DriverPayoutStatus.processed,
        },
      });

      // Notifications (best-effort) after the transaction commits.
      void this.notifySettled(delivery.order.clientId, driver.id, deliveryId);
      return settled;
    });
  }

  // --- internals ----------------------------------------------------------

  private async transition(
    deliveryId: string,
    orderId: string,
    orderStatus: OrderStatus,
    deliveryData: Prisma.DeliveryUpdateInput,
  ): Promise<Delivery> {
    const [, delivery] = await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { status: orderStatus } }),
      this.prisma.delivery.update({ where: { id: deliveryId }, data: deliveryData }),
    ]);
    this.realtime.emitDeliveryStatus(deliveryId, orderStatus);
    return delivery;
  }

  private async assertDriverDelivery(id: string, driverId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (delivery.livreurId !== driverId) {
      throw new ForbiddenException('You are not the driver for this delivery.');
    }
    return delivery;
  }

  private async notifySettled(
    clientId: string,
    driverId: string,
    deliveryId: string,
  ): Promise<void> {
    await this.notifications.notify(clientId, {
      type: NotificationType.delivery,
      title: 'Delivered',
      body: 'Your package was delivered. Please rate your driver.',
      data: { deliveryId },
    });
    await this.notifications.notify(driverId, {
      type: NotificationType.delivery,
      title: 'Earnings credited',
      body: 'Delivery complete. Your net earnings have been added to your balance.',
      data: { deliveryId },
    });
  }
}
