import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Delivery,
  NotificationType,
  Offer,
  OfferStatus,
  Order,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOfferDto } from './dto/create-offer.dto';

/** Order states in which drivers may still bid. */
const BIDDABLE: OrderStatus[] = [OrderStatus.published, OrderStatus.offers_received];

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async createOffer(orderId: string, livreurId: string, dto: CreateOfferDto): Promise<Offer> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.clientId === livreurId) {
      throw new BadRequestException('You cannot bid on your own order.');
    }
    if (!BIDDABLE.includes(order.status)) {
      throw new BadRequestException(`Order is not open for offers (status "${order.status}").`);
    }

    // Driver must be verified by an admin and currently online to bid.
    const driver = await this.prisma.user.findUnique({
      where: { id: livreurId },
      select: { isVerified: true, isOnline: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found.');
    }
    if (!driver.isVerified) {
      throw new ForbiddenException('Your driver account is not verified yet.');
    }
    if (!driver.isOnline) {
      throw new BadRequestException('You must be online to submit an offer.');
    }

    const proposed = new Prisma.Decimal(dto.proposedPrice);
    const minPrice = order.minPriceSuggested ?? new Prisma.Decimal(0);
    if (proposed.lessThan(minPrice)) {
      throw new BadRequestException(`Proposed price must be at least ${minPrice.toFixed(2)}.`);
    }

    const expiresAt = new Date(Date.now() + this.config.get('OFFER_TTL_MIN') * 60_000);

    let offer: Offer;
    try {
      offer = await this.prisma.offer.create({
        data: {
          orderId,
          livreurId,
          proposedPrice: proposed,
          minPrice,
          expiresAt,
        },
      });
    } catch (err) {
      // UNIQUE(order_id, livreur_id): one bid per driver per order.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You have already made an offer on this order.');
      }
      throw err;
    }

    // First offer moves the order into "offers_received".
    if (order.status === OrderStatus.published) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.offers_received },
      });
    }

    await this.notifyClientOfOffer(order, offer);
    return offer;
  }

  async listOffers(orderId: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.clientId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this order.');
    }

    const offers = await this.prisma.offer.findMany({
      where: { orderId },
      orderBy: { proposedPrice: 'asc' },
      include: {
        livreur: {
          select: {
            id: true,
            fullName: true,
            profilePhoto: true,
            ratingDriver: true,
            totalDeliveries: true,
          },
        },
      },
    });

    return {
      orderId,
      minPrice: order.minPriceSuggested != null ? Number(order.minPriceSuggested) : null,
      offers: offers.map((o) => ({
        id: o.id,
        livreurId: o.livreur.id,
        livreurName: o.livreur.fullName,
        livreurPhoto: o.livreur.profilePhoto,
        livreurRating: Number(o.livreur.ratingDriver),
        livreurTotalDeliveries: o.livreur.totalDeliveries,
        proposedPrice: Number(o.proposedPrice),
        status: o.status,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
      })),
    };
  }

  /**
   * Client accepts an offer. Atomically: mark the offer accepted, lock the order
   * (status accepted, accepted_offer_id), expire all other offers, and create the
   * delivery. Then notify the winning and losing drivers.
   */
  async acceptOffer(offerId: string, clientId: string): Promise<{
    order: Order;
    delivery: Delivery;
    offer: Offer;
  }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: { order: true },
      });
      if (!offer) {
        throw new NotFoundException('Offer not found.');
      }
      if (offer.order.clientId !== clientId) {
        throw new ForbiddenException('You do not own the order for this offer.');
      }
      if (offer.order.acceptedOfferId) {
        throw new ConflictException('An offer has already been accepted for this order.');
      }
      if (offer.status !== OfferStatus.pending) {
        throw new BadRequestException(`Offer is not pending (status "${offer.status}").`);
      }

      await tx.offer.update({
        where: { id: offer.id },
        data: { status: OfferStatus.accepted },
      });

      // Expire every other bid on this order.
      await tx.offer.updateMany({
        where: { orderId: offer.orderId, id: { not: offer.id }, status: OfferStatus.pending },
        data: { status: OfferStatus.expired },
      });

      const order = await tx.order.update({
        where: { id: offer.orderId },
        data: { status: OrderStatus.accepted, acceptedOfferId: offer.id },
      });

      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          livreurId: offer.livreurId,
          distanceKm: order.distanceKm,
          basePrice: offer.proposedPrice,
        },
      });

      return { order, delivery, offer };
    });

    await this.notifyOnAcceptance(result.order, result.delivery, result.offer, clientId);
    return result;
  }

  async rejectOffer(offerId: string, clientId: string): Promise<Offer> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { order: { select: { clientId: true } } },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }
    if (offer.order.clientId !== clientId) {
      throw new ForbiddenException('You do not own the order for this offer.');
    }
    if (offer.status !== OfferStatus.pending) {
      throw new BadRequestException(`Offer is not pending (status "${offer.status}").`);
    }

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.rejected },
    });

    this.realtime.emitToOrder(offer.orderId, 'offer:rejected', {
      offerId,
      orderId: offer.orderId,
    });
    await this.notifications.notify(offer.livreurId, {
      type: NotificationType.offer,
      title: 'Offer declined',
      body: 'The client declined your offer.',
      data: { offerId, orderId: offer.orderId },
    });
    return updated;
  }

  // --- notifications ------------------------------------------------------

  private async notifyClientOfOffer(order: Order, offer: Offer): Promise<void> {
    const payload = {
      offerId: offer.id,
      orderId: order.id,
      livreurId: offer.livreurId,
      proposedPrice: Number(offer.proposedPrice),
    };
    this.realtime.emitToOrder(order.id, 'offer:new', payload);
    await this.notifications.notify(order.clientId, {
      type: NotificationType.offer,
      title: 'New offer received',
      body: `A driver offered ${Number(offer.proposedPrice).toFixed(2)} for your delivery.`,
      data: payload,
    });
  }

  private async notifyOnAcceptance(
    order: Order,
    delivery: Delivery,
    offer: Offer,
    _clientId: string,
  ): Promise<void> {
    // Everyone watching the order (client + bidders) sees the acceptance.
    this.realtime.emitToOrder(order.id, 'offer:accepted', {
      offerId: offer.id,
      orderId: order.id,
      deliveryId: delivery.id,
      livreurId: offer.livreurId,
    });
    // Seed the delivery room with the initial status.
    this.realtime.emitDeliveryStatus(delivery.id, delivery.status);

    const winnerPayload = { deliveryId: delivery.id, orderId: order.id, offerId: offer.id };
    await this.notifications.notify(offer.livreurId, {
      type: NotificationType.delivery,
      title: 'Offer accepted!',
      body: 'Your offer was accepted. Head to the pickup location.',
      data: winnerPayload,
    });

    // Losers
    const losers = await this.prisma.offer.findMany({
      where: { orderId: order.id, status: OfferStatus.expired },
      select: { livreurId: true },
      distinct: ['livreurId'],
    });
    await this.notifications.notifyMany(
      losers.map((l) => l.livreurId),
      {
        type: NotificationType.offer,
        title: 'Offer not selected',
        body: 'The client chose another driver for this delivery.',
        data: { orderId: order.id },
      },
    );
  }
}
