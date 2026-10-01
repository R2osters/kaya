import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CountryCode, NotificationType, Order, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService, PriceQuote } from '../pricing/pricing.service';
import { GeoService } from '../geo/geo.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';

/** Statuses from which a client may still cancel. */
const CANCELLABLE: OrderStatus[] = [
  OrderStatus.draft,
  OrderStatus.published,
  OrderStatus.offers_received,
  OrderStatus.accepted,
];

/** A scheduled order must be at least this many minutes in the future. */
const SCHEDULE_MIN_LEAD_MIN = 45;

/** Statuses in which a client may still edit an order (no accepted offer). */
const EDITABLE: OrderStatus[] = [OrderStatus.draft, OrderStatus.published];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly geo: GeoService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(clientId: string, country: CountryCode, dto: CreateOrderDto): Promise<Order> {
    const quote = await this.pricing.quote(
      country,
      { lat: dto.pickupLat, lng: dto.pickupLng },
      { lat: dto.deliveryLat, lng: dto.deliveryLng },
    );

    const scheduledTime = dto.scheduledTime ? new Date(dto.scheduledTime) : null;
    this.assertScheduleLead(scheduledTime);
    const isScheduled = scheduledTime !== null;

    const order = await this.prisma.order.create({
      data: {
        clientId,
        pickupAddress: dto.pickupAddress,
        pickupLat: new Prisma.Decimal(dto.pickupLat),
        pickupLng: new Prisma.Decimal(dto.pickupLng),
        deliveryAddress: dto.deliveryAddress,
        deliveryLat: new Prisma.Decimal(dto.deliveryLat),
        deliveryLng: new Prisma.Decimal(dto.deliveryLng),
        description: dto.description,
        packagePhoto: dto.packagePhoto,
        weightKg: dto.weightKg != null ? new Prisma.Decimal(dto.weightKg) : null,
        dimensions: dto.dimensions,
        scheduledTime,
        distanceKm: quote.distanceKm,
        minPriceSuggested: quote.minPrice,
        status: OrderStatus.draft,
      },
    });

    // Immediate orders publish now; scheduled ones wait for the cron.
    if (!isScheduled) {
      return this.publishInternal(order);
    }
    return order;
  }

  async findMine(
    clientId: string,
    opts: { status?: OrderStatus; page?: number; limit?: number },
  ): Promise<{ data: Order[]; page: number; limit: number; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const where = { clientId, ...(opts.status ? { status: opts.status } : {}) };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  private assertScheduleLead(scheduledTime: Date | null): void {
    if (!scheduledTime) {
      return;
    }
    const minAt = Date.now() + SCHEDULE_MIN_LEAD_MIN * 60_000;
    if (scheduledTime.getTime() < minAt) {
      throw new BadRequestException(
        `scheduled_time must be at least ${SCHEDULE_MIN_LEAD_MIN} minutes in the future.`,
      );
    }
  }

  async findOne(id: string, user: AuthUser): Promise<Order & { offersCount: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { _count: { select: { offers: true } } },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (!(await this.canViewOrder(order.id, order.clientId, order.status, user))) {
      throw new ForbiddenException('You do not have access to this order.');
    }
    const { _count, ...rest } = order;
    return { ...rest, offersCount: _count.offers };
  }

  /** Owner client, admin, a driver who bid, or the assigned delivery driver. */
  private async canViewOrder(
    orderId: string,
    ownerClientId: string,
    status: OrderStatus,
    user: AuthUser,
  ): Promise<boolean> {
    if (user.id === ownerClientId || user.role === 'admin') {
      return true;
    }
    // A driver may read an order that is open for bids. `GET /orders/nearby`
    // already hands every online driver the same fields for the same rows, so
    // refusing the single-order read while allowing the list read protected
    // nothing -- it only made the bid screen impossible: it loads the order to
    // learn `minPriceSuggested`, the floor the whole screen is built around,
    // and got a 403 for an order the driver had just been shown.
    //
    // Deliberately not "any status": once an order is accepted it stops being
    // a listing and becomes a job with two named participants, and the checks
    // below are what decide who those are.
    const openToDrivers: OrderStatus[] = [OrderStatus.published, OrderStatus.offers_received];
    const isDriver = user.role === Role.livreur || user.role === Role.both;
    if (isDriver && openToDrivers.includes(status)) {
      return true;
    }
    const [bid, delivery] = await Promise.all([
      this.prisma.offer.findFirst({
        where: { orderId, livreurId: user.id },
        select: { id: true },
      }),
      this.prisma.delivery.findFirst({
        where: { orderId, livreurId: user.id },
        select: { id: true },
      }),
    ]);
    return bid !== null || delivery !== null;
  }

  async update(
    id: string,
    country: CountryCode,
    clientId: string,
    dto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.getOwnedOrder(id, clientId);
    if (!EDITABLE.includes(order.status) || order.acceptedOfferId) {
      throw new BadRequestException(
        'An order can only be edited while draft or published without an accepted offer.',
      );
    }
    if (dto.scheduledTime) {
      this.assertScheduleLead(new Date(dto.scheduledTime));
    }

    // Recompute distance/price when any coordinate changes.
    const coordsChanged =
      dto.pickupLat != null ||
      dto.pickupLng != null ||
      dto.deliveryLat != null ||
      dto.deliveryLng != null;

    let quote: PriceQuote | null = null;
    if (coordsChanged) {
      quote = await this.pricing.quote(
        country,
        {
          lat: dto.pickupLat ?? Number(order.pickupLat),
          lng: dto.pickupLng ?? Number(order.pickupLng),
        },
        {
          lat: dto.deliveryLat ?? Number(order.deliveryLat),
          lng: dto.deliveryLng ?? Number(order.deliveryLng),
        },
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat != null ? new Prisma.Decimal(dto.pickupLat) : undefined,
        pickupLng: dto.pickupLng != null ? new Prisma.Decimal(dto.pickupLng) : undefined,
        deliveryAddress: dto.deliveryAddress,
        deliveryLat: dto.deliveryLat != null ? new Prisma.Decimal(dto.deliveryLat) : undefined,
        deliveryLng: dto.deliveryLng != null ? new Prisma.Decimal(dto.deliveryLng) : undefined,
        description: dto.description,
        packagePhoto: dto.packagePhoto,
        weightKg: dto.weightKg != null ? new Prisma.Decimal(dto.weightKg) : undefined,
        dimensions: dto.dimensions,
        scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : undefined,
        distanceKm: quote?.distanceKm,
        minPriceSuggested: quote?.minPrice,
      },
    });
  }

  async publish(id: string, clientId: string): Promise<Order> {
    const order = await this.getOwnedOrder(id, clientId);
    if (order.status !== OrderStatus.draft) {
      throw new BadRequestException('Only draft orders can be published.');
    }
    return this.publishInternal(order);
  }

  async cancel(id: string, clientId: string, reason?: string): Promise<Order> {
    const order = await this.getOwnedOrder(id, clientId);
    if (!CANCELLABLE.includes(order.status)) {
      throw new BadRequestException(`Order cannot be cancelled from status "${order.status}".`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: OrderStatus.cancelled, cancelReason: reason ?? null },
      }),
      this.prisma.offer.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'expired' },
      }),
    ]);

    // Let drivers who bid know the order is gone.
    const bidders = await this.prisma.offer.findMany({
      where: { orderId: id },
      select: { livreurId: true },
      distinct: ['livreurId'],
    });
    await this.notifications.notifyMany(
      bidders.map((b) => b.livreurId),
      {
        type: NotificationType.order,
        title: 'Order cancelled',
        body: 'A delivery you bid on was cancelled by the client.',
        data: { orderId: id },
      },
    );
    return updated;
  }

  async nearby(driver: AuthUser, query: NearbyQueryDto) {
    const driverRow = await this.prisma.user.findUnique({
      where: { id: driver.id },
      select: { locationLat: true, locationLng: true, countryCode: true },
    });
    const lat = query.lat ?? (driverRow?.locationLat ? Number(driverRow.locationLat) : undefined);
    const lng = query.lng ?? (driverRow?.locationLng ? Number(driverRow.locationLng) : undefined);
    if (lat == null || lng == null) {
      throw new BadRequestException(
        'No location available. Provide lat/lng or update your GPS position first.',
      );
    }

    const radiusKm =
      query.radiusKm ?? (await this.searchRadiusKm(driver.countryCode as CountryCode));
    const rows = await this.geo.findPublishedOrdersNearby(lat, lng, radiusKm, driver.id);

    return rows.map((r) => ({
      id: r.id,
      pickupAddress: r.pickup_address,
      pickupLat: Number(r.pickup_lat),
      pickupLng: Number(r.pickup_lng),
      deliveryAddress: r.delivery_address,
      deliveryLat: Number(r.delivery_lat),
      deliveryLng: Number(r.delivery_lng),
      description: r.description,
      distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
      minPriceSuggested: r.min_price_suggested != null ? Number(r.min_price_suggested) : null,
      status: r.status,
      distanceToPickupKm: Math.round((r.meters / 1000) * 100) / 100,
      createdAt: r.created_at,
    }));
  }

  // --- scheduler entry points ---------------------------------------------

  /**
   * Publishes scheduled draft orders whose publish window (scheduled_time -
   * buffer) has arrived. Called every minute by OrdersScheduler.
   */
  async publishDueScheduledOrders(now = new Date()): Promise<number> {
    const configs = await this.loadConfigMap();
    const maxBufferMin = Math.max(
      5,
      ...[...configs.values()].map((c) => c.scheduledPublishBufferMin),
    );
    const horizon = new Date(now.getTime() + maxBufferMin * 60_000);

    const due = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.draft,
        scheduledTime: { not: null, lte: horizon },
      },
      include: { client: { select: { countryCode: true } } },
    });

    let published = 0;
    for (const order of due) {
      const buffer = configs.get(order.client.countryCode)?.scheduledPublishBufferMin ?? 30;
      const publishAt = new Date(order.scheduledTime!.getTime() - buffer * 60_000);
      if (now >= publishAt) {
        await this.publishInternal(order);
        published += 1;
      }
    }
    if (published > 0) {
      this.logger.log(`Published ${published} scheduled order(s).`);
    }
    return published;
  }

  /**
   * Sends a one-time "delivery soon" reminder to clients whose scheduled order
   * is within reminder_before_min of its scheduled time. Deduplicated via the
   * order.reminded_at column (set once the reminder is sent).
   */
  async sendDeliveryReminders(now = new Date()): Promise<number> {
    const configs = await this.loadConfigMap();
    const maxReminderMin = Math.max(5, ...[...configs.values()].map((c) => c.reminderBeforeMin));
    const horizon = new Date(now.getTime() + maxReminderMin * 60_000);

    const upcoming = await this.prisma.order.findMany({
      where: {
        scheduledTime: { not: null, gt: now, lte: horizon },
        remindedAt: null,
        status: {
          in: [
            OrderStatus.draft,
            OrderStatus.published,
            OrderStatus.offers_received,
            OrderStatus.accepted,
            OrderStatus.driver_en_route,
          ],
        },
      },
      include: { client: { select: { countryCode: true } } },
    });

    let sent = 0;
    for (const order of upcoming) {
      const reminderMin = configs.get(order.client.countryCode)?.reminderBeforeMin ?? 60;
      const reminderAt = new Date(order.scheduledTime!.getTime() - reminderMin * 60_000);
      if (now < reminderAt) {
        continue;
      }
      // Stamp first so a concurrent tick cannot double-send.
      await this.prisma.order.update({ where: { id: order.id }, data: { remindedAt: now } });
      await this.notifications.notify(order.clientId, {
        type: NotificationType.order,
        title: 'Delivery reminder',
        body: `Your scheduled delivery is coming up at ${order.scheduledTime!.toISOString()}.`,
        data: { reminderFor: order.id },
      });
      sent += 1;
    }
    return sent;
  }

  private async loadConfigMap() {
    const configs = await this.prisma.countryConfig.findMany();
    return new Map(configs.map((c) => [c.countryCode, c]));
  }

  // --- internals ----------------------------------------------------------

  private async publishInternal(order: Order): Promise<Order> {
    const published = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.published, publishedAt: new Date() },
    });

    // Fan out to nearby online drivers (best-effort; never blocks the request).
    void this.fanOutToNearbyDrivers(published).catch((err) =>
      this.logger.warn(`Publish fan-out failed for order ${published.id}: ${err.message}`),
    );
    return published;
  }

  private async fanOutToNearbyDrivers(order: Order): Promise<void> {
    const config = await this.prisma.countryConfig.findFirst({
      where: { countryCode: await this.clientCountry(order.clientId) },
    });
    const radiusKm = config?.searchRadiusKm ?? 5;

    const driverIds = await this.geo.findOnlineDriverIdsNearby(
      Number(order.pickupLat),
      Number(order.pickupLng),
      radiusKm,
      config?.countryCode as CountryCode,
    );
    if (driverIds.length === 0) {
      return;
    }

    const payload = {
      orderId: order.id,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      distanceKm: order.distanceKm ? Number(order.distanceKm) : null,
      minPriceSuggested: order.minPriceSuggested ? Number(order.minPriceSuggested) : null,
    };
    // Nearby drivers are not yet in any room; reach them via push (persisted).
    await this.notifications.notifyMany(driverIds, {
      type: NotificationType.order,
      title: 'New delivery nearby',
      body: `Pickup: ${order.pickupAddress}`,
      data: payload,
    });
  }

  private async clientCountry(clientId: string): Promise<CountryCode> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { countryCode: true },
    });
    return client!.countryCode;
  }

  private async searchRadiusKm(country: CountryCode): Promise<number> {
    const config = await this.prisma.countryConfig.findUnique({ where: { countryCode: country } });
    return config?.searchRadiusKm ?? 5;
  }

  private async getOwnedOrder(id: string, clientId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.clientId !== clientId) {
      throw new ForbiddenException('You do not own this order.');
    }
    return order;
  }

  /** Used by the scheduler to compute a price quote for calculate-price. */
  async quotePrice(
    country: CountryCode,
    pickup: { lat: number; lng: number },
    delivery: { lat: number; lng: number },
  ): Promise<PriceQuote> {
    return this.pricing.quote(country, pickup, delivery);
  }
}
