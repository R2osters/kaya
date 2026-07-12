import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CountryCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DISTANCE_PROVIDER,
  DistanceProvider,
  LatLng,
} from '../maps/distance-provider.interface';

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
    const minPrice = distance
      .mul(config.pricePerKm)
      .plus(config.basePickupFee)
      // Money resolves to 2 decimals.
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

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
