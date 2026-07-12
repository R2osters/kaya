import { BadRequestException } from '@nestjs/common';
import { CountryCode, OrderStatus, Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const pricing = {
    quote: jest.fn().mockResolvedValue({
      distanceKm: new Prisma.Decimal('10'),
      minPrice: new Prisma.Decimal('12.00'),
      currency: 'GHS',
      currencySymbol: 'GHS',
      pricePerKm: new Prisma.Decimal('1.00'),
      basePickupFee: new Prisma.Decimal('2.00'),
      durationMin: 24,
      source: 'haversine',
    }),
  };
  const geo = { findOnlineDriverIdsNearby: jest.fn().mockResolvedValue([]), findPublishedOrdersNearby: jest.fn() };
  const notifications = { notify: jest.fn(), notifyMany: jest.fn() };

  function makePrisma() {
    return {
      order: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ countryCode: CountryCode.GHA }) },
      countryConfig: {
        findFirst: jest.fn().mockResolvedValue({ countryCode: CountryCode.GHA, searchRadiusKm: 5 }),
        findUnique: jest.fn().mockResolvedValue({ searchRadiusKm: 5 }),
      },
    };
  }

  let prisma: ReturnType<typeof makePrisma>;
  let service: OrdersService;

  const baseDto = {
    pickupAddress: 'A',
    pickupLat: 5.6,
    pickupLng: -0.18,
    deliveryAddress: 'B',
    deliveryLat: 5.63,
    deliveryLng: -0.16,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new OrdersService(
      prisma as never,
      pricing as never,
      geo as never,
      notifications as never,
    );
  });

  it('publishes an immediate order (no scheduled_time) and stamps min price', async () => {
    prisma.order.create.mockResolvedValue({
      id: 'order1',
      clientId: 'client1',
      status: OrderStatus.draft,
      pickupLat: new Prisma.Decimal('5.6'),
      pickupLng: new Prisma.Decimal('-0.18'),
      distanceKm: new Prisma.Decimal('10'),
      minPriceSuggested: new Prisma.Decimal('12.00'),
    });
    prisma.order.update.mockResolvedValue({
      id: 'order1',
      clientId: 'client1',
      status: OrderStatus.published,
      pickupLat: new Prisma.Decimal('5.6'),
      pickupLng: new Prisma.Decimal('-0.18'),
      distanceKm: new Prisma.Decimal('10'),
      minPriceSuggested: new Prisma.Decimal('12.00'),
    });

    const order = await service.create('client1', CountryCode.GHA, baseDto);

    expect(pricing.quote).toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.published);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.published }) }),
    );
  });

  it('keeps a future scheduled order in draft (not published immediately)', async () => {
    const future = new Date(Date.now() + 3 * 3600_000).toISOString();
    prisma.order.create.mockResolvedValue({
      id: 'order2',
      clientId: 'client1',
      status: OrderStatus.draft,
    });

    const order = await service.create('client1', CountryCode.GHA, { ...baseDto, scheduledTime: future });

    expect(order.status).toBe(OrderStatus.draft);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling an order that is already delivered', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order3',
      clientId: 'client1',
      status: OrderStatus.delivered,
    });
    await expect(service.cancel('order3', 'client1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
