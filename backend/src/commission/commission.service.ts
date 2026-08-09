import { Injectable } from '@nestjs/common';
import { CountryConfig, Prisma } from '@prisma/client';
import { roundMoney } from '../common/money';

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
 * net_earnings = base_price - commission - litigation_fee. Money is Decimal,
 * and every amount is rounded to the *currency's* own smallest unit (see
 * common/money.ts) rather than to two decimals for everyone. XOF has no
 * fractional part at all, and rounding its parts to 2dp made a breakdown stop
 * summing to its total once displayed -- the driver's earnings screen showing
 * three numbers that do not add up, with the difference accumulating in an
 * append-only ledger.
 */
@Injectable()
export class CommissionService {
  calculate(
    basePrice: Prisma.Decimal,
    dailyDeliveryNumber: number,
    config: Pick<
      CountryConfig,
      | 'commissionTier1'
      | 'commissionTier2'
      | 'commissionTier3'
      | 'commissionTier4'
      | 'litigationFee'
      | 'currencyCode'
    >,
  ): CommissionBreakdown {
    const rate = this.rateFor(dailyDeliveryNumber, config);
    const currency = config.currencyCode;
    const commission = roundMoney(basePrice.mul(rate), currency);
    const litigationFee = roundMoney(new Prisma.Decimal(config.litigationFee), currency);
    // Subtracts the already-rounded parts, so net is exactly what is left
    // after them rather than a separately-rounded figure that can differ by
    // one unit from base - commission - litigation.
    const netEarnings = roundMoney(basePrice.minus(commission).minus(litigationFee), currency);

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
