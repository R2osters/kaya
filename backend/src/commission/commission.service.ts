import { Injectable } from '@nestjs/common';
import { CountryConfig, Prisma } from '@prisma/client';

export interface CommissionBreakdown {
  rate: Prisma.Decimal;
  commission: Prisma.Decimal;
  litigationFee: Prisma.Decimal;
  netEarnings: Prisma.Decimal;
}

/**
 * Degressive commission (Architecture doc §4.4, Blueprint decision):
 * the tier is set by the delivery's number within the driver's local day
 * (the 7th delivery of the day is charged at tier 2, etc.).
 *
 *   <= 6  -> tier1 (20%)
 *   7-10  -> tier2 (15%)
 *   11-14 -> tier3 (12%)
 *   >= 15 -> tier4 (9%)
 *
 * net_earnings = base_price - commission - litigation_fee. Money is Decimal.
 */
@Injectable()
export class CommissionService {
  calculate(
    basePrice: Prisma.Decimal,
    dailyDeliveryNumber: number,
    config: Pick<
      CountryConfig,
      'commissionTier1' | 'commissionTier2' | 'commissionTier3' | 'commissionTier4' | 'litigationFee'
    >,
  ): CommissionBreakdown {
    const rate = this.rateFor(dailyDeliveryNumber, config);
    const commission = basePrice.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const litigationFee = new Prisma.Decimal(config.litigationFee);
    const netEarnings = basePrice
      .minus(commission)
      .minus(litigationFee)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return { rate: new Prisma.Decimal(rate), commission, litigationFee, netEarnings };
  }

  private rateFor(
    n: number,
    config: Pick<
      CountryConfig,
      'commissionTier1' | 'commissionTier2' | 'commissionTier3' | 'commissionTier4'
    >,
  ): Prisma.Decimal {
    if (n <= 6) return new Prisma.Decimal(config.commissionTier1);
    if (n <= 10) return new Prisma.Decimal(config.commissionTier2);
    if (n <= 14) return new Prisma.Decimal(config.commissionTier3);
    return new Prisma.Decimal(config.commissionTier4);
  }
}
