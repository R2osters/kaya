import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { deliveryRoom, orderRoom, RealtimeService } from './realtime.service';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';

interface LocationUpdate {
  lat: number;
  lng: number;
}
interface OrderJoin {
  order_id: string;
}
interface ChatJoin {
  delivery_id: string;
}
interface ChatMessage {
  delivery_id: string;
  message_text?: string;
  image_url?: string;
}

// Flush a driver's GPS to Postgres at most once per this many seconds.
const GEO_FLUSH_WINDOW_SEC = 30;

/**
 * Realtime gateway (Socket.io). Authenticates the handshake JWT, manages
 * delivery rooms, relays chat, and streams driver GPS.
 * Contract (Architecture doc §3.5/§3.6):
 *   client -> 'order:join'      { order_id }         (client owner or a bidder)
 *   client -> 'chat:join'       { delivery_id }
 *   client -> 'location:update' { lat, lng }         (driver)
 *   client -> 'chat:message'    { delivery_id, message_text, image_url }
 *   server -> 'offer:new'       { offerId, orderId, livreurId, proposedPrice }   (order room)
 *   server -> 'offer:accepted'  { offerId, orderId, deliveryId, livreurId }      (order room)
 *   server -> 'offer:rejected'  { offerId, orderId }                             (order room)
 *   server -> 'location:driver' { livreur_id, lat, lng, timestamp }              (delivery room)
 *   server -> 'chat:message'    { id, sender_id, message_text, image_url, created_at } (delivery room)
 *   server -> 'delivery:status' { delivery_id, status, timestamp }               (delivery room)
 */
// CORS: same whitelist as HTTP (CORS_ORIGINS env). Empty list = allow all in
// dev only; production must set CORS_ORIGINS (enforced by the security audit).
const socketOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: socketOrigins.length > 0 ? socketOrigins : true,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.bind(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing token');
      }
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch (err) {
      this.logger.debug(`Rejected socket ${client.id}: ${(err as Error).message}`);
      client.emit('error', { message: 'Unauthorized socket connection.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('order:join')
  async onOrderJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: OrderJoin,
  ): Promise<{ joined: boolean }> {
    const userId = client.data.userId as string;
    const allowed = await this.canWatchOrder(body.order_id, userId);
    if (!allowed) {
      return { joined: false };
    }
    await client.join(orderRoom(body.order_id));
    return { joined: true };
  }

  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatJoin,
  ): Promise<{ joined: boolean }> {
    const userId = client.data.userId as string;
    const delivery = await this.assertParticipant(body.delivery_id, userId);
    if (!delivery) {
      return { joined: false };
    }
    await client.join(deliveryRoom(body.delivery_id));
    return { joined: true };
  }

  @SubscribeMessage('location:update')
  async onLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LocationUpdate,
  ): Promise<void> {
    const userId = client.data.userId as string;
    const role = client.data.role as string;
    if (role !== 'livreur' && role !== 'both') {
      return; // only drivers publish positions
    }
    if (!this.isValidLatLng(body)) {
      return;
    }

    // Hot path: write to Redis every tick, not Postgres.
    await this.redis.setDriverPosition(userId, body.lat, body.lng);

    // Throttled cold path: keep users.location fresh for proximity search.
    if (await this.redis.shouldRun(`geoflush:${userId}`, GEO_FLUSH_WINDOW_SEC)) {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: {
            locationLat: body.lat,
            locationLng: body.lng,
            locationUpdatedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    // Fan out to the driver's active delivery room (client is tracking it).
    const active = await this.prisma.delivery.findFirst({
      where: { livreurId: userId, status: 'in_progress' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (active) {
      this.realtime.emitToDelivery(active.id, 'location:driver', {
        livreur_id: userId,
        lat: body.lat,
        lng: body.lng,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('chat:message')
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatMessage,
  ): Promise<void> {
    const userId = client.data.userId as string;
    const delivery = await this.assertParticipant(body.delivery_id, userId);
    if (!delivery) {
      return;
    }
    if (!body.message_text && !body.image_url) {
      return;
    }

    const receiverId = delivery.order.clientId === userId ? delivery.livreurId : delivery.order.clientId;
    const message = await this.prisma.message.create({
      data: {
        deliveryId: body.delivery_id,
        senderId: userId,
        receiverId,
        messageText: body.message_text ?? null,
        imageUrl: body.image_url ?? null,
      },
    });

    this.realtime.emitToDelivery(body.delivery_id, 'chat:message', {
      id: message.id,
      sender_id: message.senderId,
      message_text: message.messageText,
      image_url: message.imageUrl,
      created_at: message.createdAt.toISOString(),
    });
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) {
      return auth.replace(/^Bearer\s+/i, '');
    }
    const header = client.handshake.headers.authorization;
    return header ? header.replace(/^Bearer\s+/i, '') : null;
  }

  /** True if the user owns the order or has placed an offer on it. */
  private async canWatchOrder(orderId: string, userId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true },
    });
    if (!order) {
      return false;
    }
    if (order.clientId === userId) {
      return true;
    }
    const bid = await this.prisma.offer.findFirst({
      where: { orderId, livreurId: userId },
      select: { id: true },
    });
    return bid !== null;
  }

  /** Returns the delivery (with order) only if the user is its client or driver. */
  private async assertParticipant(deliveryId: string, userId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { clientId: true } } },
    });
    if (!delivery) {
      return null;
    }
    const isParticipant = delivery.livreurId === userId || delivery.order.clientId === userId;
    return isParticipant ? delivery : null;
  }

  private isValidLatLng(p: LocationUpdate): boolean {
    return (
      typeof p?.lat === 'number' &&
      typeof p?.lng === 'number' &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
    );
  }
}
