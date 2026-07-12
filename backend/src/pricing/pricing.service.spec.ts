import { NotFoundException } from '@nestjs/common';
import { CountryCode, Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  function createPrismaMock(config: unknown) {
    return { countryConfig: { findUnique: jest.fn().mockResolvedValue(config) } };
  }

  const distanceProvider = {
    name: 'haversine',
    distance: jest.fn(),
  };

  const ghanaConfig = {
    countryCode: CountryCode.GHA,
    currencyCode: 'GHS',
    currencySymbol: 'GHS',
    pricePerKm: new Prisma.Decimal('1.00'),
    basePickupFee: new Prisma.Decimal('2.00'),
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('computes min price = distance_km * price_per_km + base_pickup_fee', async () => {
    distanceProvider.distance.mockResolvedValue({ distanceKm: 10, durationMin: 24, source: 'haversine' });
    const service = new PricingService(
      createPrismaMock(ghanaConfig) as never,
      distanceProvider as never,
    );

    const quote = await service.quote(
      CountryCode.GHA,
      { lat: 5.6, lng: -0.18 },
      { lat: 5.63, lng: -0.16 },
    );

    // 10 * 1.00 + 2.00 = 12.00
    expect(quote.minPrice.toFixed(2)).toBe('12.00');
    expect(quote.currency).toBe('GHS');
    expect(Number(quote.distanceKm)).toBe(10);
  });

  it('applies the XOF tariff (150/km + 300)', async () => {
    distanceProvider.distance.mockResolvedValue({ distanceKm: 4, durationMin: 12, source: 'haversine' });
    const togoConfig = {
      ...ghanaConfig,
      currencyCode: 'XOF',
      currencySymbol: 'CFA',
      pricePerKm: new Prisma.Decimal('150'),
      basePickupFee: new Prisma.Decimal('300'),
    };
    const service = new PricingService(
      createPrismaMock(togoConfig) as never,
      distanceProvider as never,
    );

    const quote = await service.quote(
      CountryCode.TGO,
      { lat: 6.1, lng: 1.2 },
      { lat: 6.2, lng: 1.25 },
    );
    // 4 * 150 + 300 = 900
    expect(quote.minPrice.toFixed(2)).toBe('900.00');
    expect(quote.currency).toBe('XOF');
  });

  it('throws when the country has no active config', async () => {
    const service = new PricingService(createPrismaMock(null) as never, distanceProvider as never);
    await expect(
      service.quote(CountryCode.BEN, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
