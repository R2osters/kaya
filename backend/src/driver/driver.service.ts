import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  WithdrawalMethod,
  Withdrawal,
  WithdrawalStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { LedgerService } from '../ledger/ledger.service';
import { CommissionService } from '../commission/commission.service';
import { localDayStartUtc } from '../common/country-timezone';
import { WithdrawDto } from './dto/withdraw.dto';

@Injectable()
export class DriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly ledger: LedgerService,
    private readonly commission: CommissionService,
  ) {}

  async getBalance(driverId: string) {
    const driver = await this.prisma.user.findUniqueOrThrow({
      where: { id: driverId },
      select: { balance: true, countryCode: true },
    });
    const country = await this.prisma.countryConfig.findUnique({
      where: { countryCode: driver.countryCode },
    });
    const recent = await this.prisma.transaction.findMany({
      where: { userId: driverId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      balance: Number(driver.balance),
      currency: country?.currencyCode ?? null,
      recentTransactions: recent.map(this.serializeTx),
    };
  }

  async getEarnings(driverId: string) {
    // Per-delivery earnings detail: date, client, base, commission, fee, net.
    const deliveries = await this.prisma.delivery.findMany({
      where: { livreurId: driverId, driverPayoutStatus: 'processed' },
      orderBy: { deliveryTime: 'desc' },
      include: { order: { include: { client: { select: { fullName: true } } } } },
    });
    return deliveries.map((d) => ({
      deliveryId: d.id,
      date: d.deliveryTime,
      clientName: d.order.client.fullName,
      basePrice: d.basePrice != null ? Number(d.basePrice) : null,
      commissionRate: d.commissionRate != null ? Number(d.commissionRate) : null,
      commissionAmount: d.commissionAmount != null ? Number(d.commissionAmount) : null,
      litigationFee: Number(d.litigationFee),
      netEarnings: d.netEarnings != null ? Number(d.netEarnings) : null,
    }));
  }

  async withdraw(driverId: string, dto: WithdrawDto): Promise<Withdrawal> {
    const driver = await this.prisma.user.findUniqueOrThrow({ where: { id: driverId } });
    const config = await this.prisma.countryConfig.findUniqueOrThrow({
      where: { countryCode: driver.countryCode },
    });

    // Method must be enabled for the country.
    const methods = (config.withdrawalMethods as string[]) ?? [];
    if (!methods.includes(dto.method)) {
      throw new BadRequestException(`Withdrawal method "${dto.method}" is not available in your country.`);
    }

    // account_details shape per method.
    this.assertAccountDetails(dto.method, dto.accountDetails);

    // One withdrawal per local day (country timezone).
    const since = localDayStartUtc(driver.countryCode);
    const todayCount = await this.prisma.withdrawal.count({
      where: { livreurId: driverId, requestedAt: { gte: since } },
    });
    if (todayCount >= 1) {
      throw new ConflictException('Only one withdrawal request is allowed per day.');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.greaterThan(driver.balance)) {
      throw new BadRequestException('Amount exceeds your available balance.');
    }

    const feePct = new Prisma.Decimal(this.config.get('WITHDRAWAL_FEE_PCT'));
    const feeAmount = amount.mul(feePct).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return this.prisma.$transaction(async (t) => {
      // Debit balance immediately to prevent double-spend; admin processes later.
      await t.user.update({
        where: { id: driverId },
        data: { balance: { decrement: amount } },
      });

      const withdrawal = await t.withdrawal.create({
        data: {
          livreurId: driverId,
          amount,
          method: dto.method,
          accountDetails: dto.accountDetails as Prisma.InputJsonValue,
          feeAmount,
          status: WithdrawalStatus.pending,
        },
      });

      await this.ledger.record(
        {
          userId: driverId,
          type: TransactionType.withdrawal,
          amount,
          currency: config.currencyCode,
          status: TransactionStatus.pending,
          paymentMethod: dto.method === 'momo' ? 'momo' : 'bank_transfer',
          metadata: { withdrawalId: withdrawal.id, feeAmount: feeAmount.toString() },
          processedAt: null,
        },
        t,
      );
      return withdrawal;
    });
  }

  async getWithdrawals(driverId: string): Promise<Withdrawal[]> {
    return this.prisma.withdrawal.findMany({
      where: { livreurId: driverId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getStats(driverId: string) {
    const driver = await this.prisma.user.findUniqueOrThrow({
      where: { id: driverId },
      select: { dailyDeliveries: true, totalDeliveries: true, balance: true, countryCode: true },
    });
    const config = await this.prisma.countryConfig.findUniqueOrThrow({
      where: { countryCode: driver.countryCode },
    });

    // Tier applying to the current (Nth) and next delivery today.
    const current = driver.dailyDeliveries; // completed so far today
    const currentTier = this.commission.calculate(new Prisma.Decimal(100), current || 1, config);
    const nextTier = this.commission.calculate(new Prisma.Decimal(100), current + 1, config);

    const since = localDayStartUtc(driver.countryCode);
    const todayAgg = await this.prisma.transaction.aggregate({
      where: {
        userId: driverId,
        type: TransactionType.driver_payout,
        processedAt: { gte: since },
      },
      _sum: { amount: true },
    });

    return {
      dailyDeliveries: driver.dailyDeliveries,
      totalDeliveries: driver.totalDeliveries,
      balance: Number(driver.balance),
      currency: config.currencyCode,
      currentCommissionRate: Number(currentTier.rate),
      nextCommissionRate: Number(nextTier.rate),
      nextTierThreshold: this.nextTierThreshold(current),
      todayEarnings: Number(todayAgg._sum.amount ?? 0),
    };
  }

  /** The delivery ordinal at which the commission rate next decreases. */
  private nextTierThreshold(current: number): number | null {
    const boundaries = [7, 11, 15];
    return boundaries.find((b) => b > current) ?? null;
  }

  private assertAccountDetails(method: WithdrawalMethod, details: Record<string, unknown>): void {
    if (method === WithdrawalMethod.momo) {
      if (!details.phone || !details.provider) {
        throw new BadRequestException('MoMo withdrawals require { phone, provider }.');
      }
    } else if (method === WithdrawalMethod.bank_transfer) {
      if (!details.account_number || !details.account_name) {
        throw new BadRequestException(
          'Bank withdrawals require { account_name, account_number, bank_code }.',
        );
      }
    }
  }

  private serializeTx = (t: {
    id: string;
    type: TransactionType;
    amount: Prisma.Decimal;
    currency: string;
    status: TransactionStatus;
    createdAt: Date;
  }) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    createdAt: t.createdAt,
  });
}
