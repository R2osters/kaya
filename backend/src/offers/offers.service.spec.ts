import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { OfferStatus, OrderStatus, Prisma } from '@prisma/client';
import { OffersService } from './offers.service';

describe('OffersService', () => {
  const config = { get: jest.fn((k: string) => (k === 'OFFER_TTL_MIN' ? 15 : undefined)) };
  const notifications = { notify: jest.fn(), notifyMany: jest.fn() };
  const realtime = {
    emitToUser: jest.fn(),
    emitToDelivery: jest.fn(),
    emitToOrder: jest.fn(),
    emitDeliveryStatus: jest.fn(),
  };

  function makePrisma() {
    return {
      order: { findUnique: jest.fn(), update: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ isVerified: true, isOnline: true }),
      },
      offer: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      delivery: { create: jest.fn() },
      $transaction: jest.fn(),
    };
  }

  let prisma: ReturnType<typeof makePrisma>;
  let service: OffersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new OffersService(
      prisma as never,
      config as never,
      notifications as never,
      realtime as never,
    );
  });

  const publishedOrder = {
    id: 'order1',
    clientId: 'client1',
    status: OrderStatus.published,
    minPriceSuggested: new Prisma.Decimal('20.00'),
    distanceKm: new Prisma.Decimal('10'),
    acceptedOfferId: null,
  };

  describe('createOffer', () => {
    it('rejects a price below the order minimum', async () => {
      prisma.order.findUnique.mockResolvedValue(publishedOrder);
      await expect(
        service.createOffer('order1', 'driver1', { proposedPrice: 15 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('rejects a driver bidding on their own order', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...publishedOrder, clientId: 'driver1' });
      await expect(
        service.createOffer('order1', 'driver1', { proposedPrice: 25 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects bidding on an order that is not open', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...publishedOrder, status: OrderStatus.accepted });
      await expect(
        service.createOffer('order1', 'driver1', { proposedPrice: 25 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a valid offer, snapshots min price, and flips the order to offers_received', async () => {
      prisma.order.findUnique.mockResolvedValue(publishedOrder);
      prisma.offer.create.mockResolvedValue({
        id: 'offer1',
        orderId: 'order1',
        livreurId: 'driver1',
        proposedPrice: new Prisma.Decimal('25.00'),
      });

      const offer = await service.createOffer('order1', 'driver1', { proposedPrice: 25 });

      expect(offer.id).toBe('offer1');
      const createArg = prisma.offer.create.mock.calls[0][0].data;
      expect(createArg.minPrice.toString()).toBe('20');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order1' },
        data: { status: OrderStatus.offers_received },
      });
      expect(realtime.emitToOrder).toHaveBeenCalledWith('order1', 'offer:new', expect.any(Object));
      expect(notifications.notify).toHaveBeenCalled();
    });

    it('maps the unique-constraint violation to a conflict (one bid per driver)', async () => {
      prisma.order.findUnique.mockResolvedValue(publishedOrder);
      prisma.offer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.createOffer('order1', 'driver1', { proposedPrice: 25 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('acceptOffer', () => {
    function wireTransaction(txImpl: Record<string, unknown>) {
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(txImpl));
    }

    it('locks the order, expires other offers, and creates the delivery', async () => {
      const tx = {
        offer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'offer1',
            orderId: 'order1',
            livreurId: 'driver1',
            status: OfferStatus.pending,
            proposedPrice: new Prisma.Decimal('25.00'),
            order: { ...publishedOrder, status: OrderStatus.offers_received },
          }),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        order: {
          update: jest
            .fn()
            .mockResolvedValue({ id: 'order1', status: OrderStatus.accepted, acceptedOfferId: 'offer1' }),
        },
        delivery: {
          create: jest.fn().mockResolvedValue({ id: 'delivery1', status: 'in_progress' }),
        },
      };
      wireTransaction(tx);

      const result = await service.acceptOffer('offer1', 'client1');

      expect(result.delivery.id).toBe('delivery1');
      // Order locked to the accepted offer.
      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'order1' },
        data: { status: OrderStatus.accepted, acceptedOfferId: 'offer1' },
      });
      // Other pending offers expired.
      expect(tx.offer.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order1', id: { not: 'offer1' }, status: OfferStatus.pending },
        data: { status: OfferStatus.expired },
      });
      // Delivery seeded with the accepted price.
      expect(tx.delivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderId: 'order1', livreurId: 'driver1' }),
      });
    });

    it('rejects acceptance by a non-owner', async () => {
      wireTransaction({
        offer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'offer1',
            status: OfferStatus.pending,
            order: { clientId: 'someone-else', acceptedOfferId: null },
          }),
        },
      });
      await expect(service.acceptOffer('offer1', 'client1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a second acceptance once an offer is already locked in', async () => {
      wireTransaction({
        offer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'offer2',
            status: OfferStatus.pending,
            order: { clientId: 'client1', acceptedOfferId: 'offer1' },
          }),
        },
      });
      await expect(service.acceptOffer('offer2', 'client1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
