import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientPaymentStatus,
  CountryCode,
  DeliveryStatus,
  OrderStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from '../ledger/ledger.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import {
  DisputeOutcome,
  ListDeliveriesAdminDto,
  ListOrdersAdminDto,
  ListUsersDto,
  ProcessWithdrawalDto,
  ResolveDisputeDto,
  SuspendUserDto,
  UpdateCountryConfigDto,
  WithdrawalAction,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly ledger: LedgerService,
    private readonly deliveries: DeliveriesService,
  ) {}

  async listUsers(q: ListUsersDto) {
    const { page, limit, skip } = this.paginate(q.page, q.limit);
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.countryCode ? { countryCode: q.countryCode } : {}),
      ...(q.isVerified != null ? { isVerified: q.isVerified } : {}),
      ...(q.isActive != null ? { isActive: q.isActive } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          countryCode: true,
          city: true,
          isVerified: true,
          isActive: true,
          driverLicenseNumber: true,
          ratingDriver: true,
          totalDeliveries: true,
          balance: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  async verifyUser(id: string, adminId: string) {
    await this.getUser(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date(), verifiedById: adminId },
    });
    await this.audit(adminId, 'user.verify', id);
    await this.notifications.notify(id, {
      type: 'system' as never,
      title: 'Account verified',
      body: 'Your driver account has been verified. You can now go online and accept deliveries.',
    });
    return this.stripUser(user);
  }

  async suspendUser(id: string, adminId: string, dto: SuspendUserDto) {
    await this.getUser(id);
    const suspend = dto.suspend ?? true;
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: !suspend },
    });
    await this.audit(adminId, suspend ? 'user.suspend' : 'user.reactivate', id, { reason: dto.reason });
    await this.notifications.notify(id, {
      type: 'system' as never,
      title: suspend ? 'Account suspended' : 'Account reactivated',
      body: suspend
        ? `Your account has been suspended.${dto.reason ? ' Reason: ' + dto.reason : ''}`
        : 'Your account has been reactivated.',
    });
    return this.stripUser(user);
  }

  /** Explicit reactivate (is_active true). */
  async reactivateUser(id: string, adminId: string) {
    await this.getUser(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive: true } });
    await this.audit(adminId, 'user.reactivate', id);
    await this.notifications.notify(id, {
      type: 'system' as never,
      title: 'Account reactivated',
      body: 'Your account has been reactivated. Welcome back.',
    });
    return this.stripUser(user);
  }

  async listOrders(q: ListOrdersAdminDto) {
    const { page, limit, skip } = this.paginate(q.page, q.limit);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.order.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  async listDeliveries(q: ListDeliveriesAdminDto) {
    const { page, limit, skip } = this.paginate(q.page, q.limit);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { order: { select: { pickupAddress: true, deliveryAddress: true } } },
      }),
      this.prisma.delivery.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  /**
   * Process a pending withdrawal. Approve marks it completed; reject refunds the
   * amount to the driver's balance and reverses the ledger row.
   */
  async processWithdrawal(id: string, adminId: string, dto: ProcessWithdrawalDto) {
    return this.prisma.$transaction(async (t) => {
      const withdrawal = await t.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found.');
      }
      if (withdrawal.status !== WithdrawalStatus.pending) {
        throw new BadRequestException(`Withdrawal is already ${withdrawal.status}.`);
      }

      const ledgerRow = await t.transaction.findFirst({
        where: {
          type: TransactionType.withdrawal,
          userId: withdrawal.livreurId,
          status: TransactionStatus.pending,
          metadata: { path: ['withdrawalId'], equals: id },
        },
      });

      if (dto.action === WithdrawalAction.approve) {
        if (ledgerRow) {
          await t.transaction.update({
            where: { id: ledgerRow.id },
            data: { status: TransactionStatus.completed, processedAt: new Date() },
          });
        }
        const updated = await t.withdrawal.update({
          where: { id },
          data: {
            status: WithdrawalStatus.completed,
            processedAt: new Date(),
            processedBy: adminId,
          },
        });
        await this.notifications.notify(withdrawal.livreurId, {
          type: 'withdrawal' as never,
          title: 'Withdrawal processed',
          body: `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} has been processed.`,
          data: { withdrawalId: id },
        });
        return updated;
      }

      // Reject: refund the reserved amount and reverse the ledger row.
      await t.user.update({
        where: { id: withdrawal.livreurId },
        data: { balance: { increment: withdrawal.amount } },
      });
      if (ledgerRow) {
        await t.transaction.update({
          where: { id: ledgerRow.id },
          data: { status: TransactionStatus.reversed, processedAt: new Date() },
        });
      }
      const updated = await t.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.failed,
          processedAt: new Date(),
          processedBy: adminId,
          rejectionReason: dto.rejectionReason ?? null,
        },
      });
      await this.notifications.notify(withdrawal.livreurId, {
        type: 'withdrawal' as never,
        title: 'Withdrawal rejected',
        body: `Your withdrawal was rejected and the amount returned to your balance.${
          dto.rejectionReason ? ' Reason: ' + dto.rejectionReason : ''
        }`,
        data: { withdrawalId: id },
      });
      return updated;
    });
  }

  async litigationFund(page?: number, limit?: number) {
    const p = this.paginate(page, limit);
    const [entries, total, last] = await this.prisma.$transaction([
      this.prisma.litigationFund.findMany({
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.limit,
      }),
      this.prisma.litigationFund.count(),
      this.prisma.litigationFund.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      balance: last ? Number(last.balanceAfter) : 0,
      total,
      page: p.page,
      limit: p.limit,
      entries,
    };
  }

  async stats() {
    const [
      userCount,
      driverCount,
      orderCount,
      deliveryCount,
      completedDeliveries,
      commissionAgg,
      litigationLast,
      pendingWithdrawals,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: { in: ['livreur', 'both'] } } }),
      this.prisma.order.count(),
      this.prisma.delivery.count(),
      this.prisma.delivery.count({ where: { status: 'completed' } }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.commission, status: TransactionStatus.completed },
        _sum: { amount: true },
      }),
      this.prisma.litigationFund.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.withdrawal.aggregate({
        where: { status: WithdrawalStatus.pending },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      users: userCount,
      drivers: driverCount,
      orders: orderCount,
      deliveries: deliveryCount,
      completedDeliveries,
      platformCommission: Number(commissionAgg._sum.amount ?? 0),
      litigationFundBalance: litigationLast ? Number(litigationLast.balanceAfter) : 0,
      pendingWithdrawals: {
        count: pendingWithdrawals._count,
        total: Number(pendingWithdrawals._sum.amount ?? 0),
      },
    };
  }

  async listDisputes(page?: number, limit?: number) {
    const { page: p, limit: l, skip } = this.paginate(page, limit);
    const where = { status: OrderStatus.disputed };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: l,
        include: {
          delivery: {
            select: { id: true, basePrice: true, clientPaymentStatus: true, driverPayoutStatus: true, livreurId: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, page: p, limit: l, total };
  }

  /**
   * Resolve a dispute. Idempotent: once the order is no longer `disputed`, a
   * repeated call is a no-op (writes nothing).
   * - refund_client: refund base_price to the client, optionally pay an
   *   indemnity from the litigation fund (capped by balance, recorded as a fund
   *   debit with balance_after), cancel the delivery.
   * - release_driver: run the normal (idempotent) settlement.
   */
  async resolveDispute(orderId: string, adminId: string, dto: ResolveDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.status !== OrderStatus.disputed || !order.delivery) {
      // Already resolved (or never disputed) -> idempotent no-op.
      return { orderId, resolved: false, status: order.status };
    }
    const delivery = order.delivery;

    if (dto.outcome === DisputeOutcome.release_driver) {
      await this.deliveries.settle(delivery.id);
      await this.prisma.$transaction([
        this.prisma.delivery.update({
          where: { id: delivery.id },
          data: { status: DeliveryStatus.completed },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.delivered },
        }),
      ]);
      await this.audit(adminId, 'dispute.release_driver', orderId, { note: dto.note });
      return { orderId, resolved: true, outcome: dto.outcome };
    }

    // refund_client
    const client = await this.prisma.user.findUniqueOrThrow({ where: { id: order.clientId } });
    const config = await this.prisma.countryConfig.findUniqueOrThrow({
      where: { countryCode: client.countryCode },
    });

    await this.prisma.$transaction(async (t) => {
      if (delivery.clientPaymentStatus === ClientPaymentStatus.escrow_held) {
        await this.ledger.record(
          {
            userId: order.clientId,
            deliveryId: delivery.id,
            type: TransactionType.refund,
            amount: new Prisma.Decimal(delivery.basePrice ?? 0),
            currency: config.currencyCode,
            status: TransactionStatus.completed,
            metadata: { reason: 'dispute refund', note: dto.note ?? null },
          },
          t,
        );
      }

      // Optional indemnity drawn from the litigation fund (capped by balance).
      if (dto.indemnity && dto.indemnity > 0) {
        const last = await t.litigationFund.findFirst({ orderBy: { createdAt: 'desc' } });
        const balance = last ? new Prisma.Decimal(last.balanceAfter) : new Prisma.Decimal(0);
        const indemnity = Prisma.Decimal.min(new Prisma.Decimal(dto.indemnity), balance);
        if (indemnity.greaterThan(0)) {
          const indemnityTx = await this.ledger.record(
            {
              userId: order.clientId,
              deliveryId: delivery.id,
              type: TransactionType.adjustment,
              amount: indemnity,
              currency: config.currencyCode,
              status: TransactionStatus.completed,
              metadata: { reason: 'dispute indemnity from litigation fund' },
            },
            t,
          );
          // Debit the fund (negative amount) with a running balance_after.
          await this.ledger.addLitigationEntry(
            {
              transactionId: indemnityTx.id,
              amount: indemnity.negated(),
              description: `Indemnity paid to client for dispute on order ${orderId}`,
              createdBy: adminId,
            },
            t,
          );
          await t.user.update({
            where: { id: order.clientId },
            data: { balance: { increment: indemnity } },
          });
        }
      }

      await t.delivery.update({
        where: { id: delivery.id },
        data: { clientPaymentStatus: ClientPaymentStatus.refunded, status: DeliveryStatus.cancelled },
      });
      await t.order.update({ where: { id: orderId }, data: { status: OrderStatus.cancelled } });
    });

    await this.audit(adminId, 'dispute.refund_client', orderId, {
      note: dto.note,
      indemnity: dto.indemnity ?? 0,
    });
    await this.notifications.notify(order.clientId, {
      type: 'payment' as never,
      title: 'Dispute resolved',
      body: 'Your dispute was resolved in your favour and your payment has been refunded.',
      data: { orderId },
    });
    return { orderId, resolved: true, outcome: dto.outcome };
  }

  async updateCountryConfig(code: CountryCode, adminId: string, dto: UpdateCountryConfigDto) {
    const existing = await this.prisma.countryConfig.findUnique({ where: { countryCode: code } });
    if (!existing) {
      throw new NotFoundException(`No configuration for country ${code}.`);
    }
    const data: Prisma.CountryConfigUpdateInput = {};
    const decimalFields: (keyof UpdateCountryConfigDto)[] = [
      'pricePerKm',
      'basePickupFee',
      'commissionTier1',
      'commissionTier2',
      'commissionTier3',
      'commissionTier4',
      'litigationFee',
    ];
    for (const f of decimalFields) {
      if (dto[f] != null) {
        (data as Record<string, unknown>)[f] = new Prisma.Decimal(dto[f] as number);
      }
    }
    if (dto.searchRadiusKm != null) data.searchRadiusKm = dto.searchRadiusKm;
    if (dto.scheduledPublishBufferMin != null)
      data.scheduledPublishBufferMin = dto.scheduledPublishBufferMin;
    if (dto.reminderBeforeMin != null) data.reminderBeforeMin = dto.reminderBeforeMin;
    if (dto.withdrawalMethods) data.withdrawalMethods = dto.withdrawalMethods;
    if (dto.momoProviders) data.momoProviders = dto.momoProviders;
    if (dto.isActive != null) data.isActive = dto.isActive;

    const updated = await this.prisma.countryConfig.update({ where: { countryCode: code }, data });
    await this.audit(adminId, 'country-config.update', code, dto as Record<string, unknown>);
    return updated;
  }

  // --- helpers ------------------------------------------------------------

  /** Records an admin action in the audit log. */
  private async audit(
    actorId: string,
    action: string,
    target?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        target: target ?? null,
        data: (data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  private paginate(page?: number, limit?: number) {
    const p = Math.max(1, page ?? 1);
    const l = Math.min(100, Math.max(1, limit ?? 20));
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  private stripUser<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _drop, ...rest } = user;
    return rest;
  }
}
