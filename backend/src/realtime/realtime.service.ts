import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Room name helpers keep event routing consistent across the app. */
export const orderRoom = (orderId: string) => `order:${orderId}`;
export const deliveryRoom = (deliveryId: string) => `delivery:${deliveryId}`;

/**
 * Thin façade over the Socket.io server so REST services (orders, offers,
 * later deliveries) can push realtime events without depending on the gateway.
 * The gateway binds the server instance here on init. Emits are no-ops until
 * the server is bound.
 *
 * Rooms:
 *   order:{id}    - offer events (client, and drivers who bid, watch live)
 *   delivery:{id} - delivery events (client + assigned driver)
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  bind(server: Server): void {
    this.server = server;
  }

  /** Emit to everyone watching an order (offer:new / offer:accepted / offer:rejected). */
  emitToOrder(orderId: string, event: string, payload: unknown): void {
    this.server?.to(orderRoom(orderId)).emit(event, payload);
  }

  /** Emit to everyone in a delivery room (location:driver / chat:message / delivery:status). */
  emitToDelivery(deliveryId: string, event: string, payload: unknown): void {
    this.server?.to(deliveryRoom(deliveryId)).emit(event, payload);
  }

  /**
   * Broadcast a delivery status change. Exposed as a named helper so the M3
   * delivery lifecycle can drive `delivery:status` without touching Socket.io.
   */
  emitDeliveryStatus(deliveryId: string, status: string): void {
    this.emitToDelivery(deliveryId, 'delivery:status', {
      delivery_id: deliveryId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}
