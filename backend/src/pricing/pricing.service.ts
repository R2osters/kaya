import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CountryCode, Prisma } from '@prisma/client';
import { roundMoney } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { DISTANCE_PROVIDER, DistanceProvider, LatLng } from '../maps/distance-provider.interface';

export interface PriceQuote {
  distanceKm: Prisma.Decimal;
  minPrice: Prisma.Decimal;
  currency: string;
  currencySymbol: string;
  pricePerKm: Prisma.Decimal;
  basePickupFee: Prisma.Decimal;
  durationMin: number | null;
  source: string;
}

/**
 * Computes the suggested minimum price for an order:
 *   min_price = distance_km * price_per_km + base_pickup_fee
 * using the per-country tariff from country_configs. All money is Decimal.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DISTANCE_PROVIDER) private readonly distanceProvider: DistanceProvider,
  ) {}

  async quote(country: CountryCode, origin: LatLng, destination: LatLng): Promise<PriceQuote> {
    const config = await this.prisma.countryConfig.findUnique({
      where: { countryCode: country },
    });
    if (!config || !config.isActive) {
      throw new NotFoundException(`No active country configuration for ${country}.`);
    }

    const { distanceKm, durationMin, source } = await this.distanceProvider.distance(
      origin,
      destination,
    );

    const distance = new Prisma.Decimal(distanceKm);
    // Rounded to the currency's own smallest unit, not to two decimals for
    // everyone: XOF has no fractional part, so a quote of 1 250,50 F is a
    // price no gateway in the CFA zone can charge. See common/money.ts.
    const minPrice = roundMoney(
      distance.mul(config.pricePerKm).plus(config.basePickupFee),
      config.currencyCode,
    );

    return {
      distanceKm: distance,
      minPrice,
      currency: config.currencyCode,
      currencySymbol: config.currencySymbol,
      pricePerKm: config.pricePerKm,
      basePickupFee: config.basePickupFee,
      durationMin,
      source,
    };
  }
}
