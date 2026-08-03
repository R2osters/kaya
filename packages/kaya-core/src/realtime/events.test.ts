import {
  SOCKET_EVENTS,
  deliveryStatusEventSchema,
  driverLocationEventSchema,
  offerAcceptedEventSchema,
  offerNewEventSchema,
  offerRejectedEventSchema,
} from "./events";

describe("socket event schemas", () => {
  it("parses offer:new with camelCase keys", () => {
    const e = offerNewEventSchema.parse({
      offerId: "of1",
      orderId: "o1",
      livreurId: "u1",
      proposedPrice: "28.00",
    });
    expect(e.proposedPrice).toBe(28);
    expect(e.offerId).toBe("of1");
  });

  it("parses offer:accepted", () => {
    const e = offerAcceptedEventSchema.parse({
      offerId: "of1",
      orderId: "o1",
      deliveryId: "d1",
      livreurId: "u1",
    });
    expect(e.deliveryId).toBe("d1");
  });

  it("parses offer:rejected (verified against offers.service.ts's emitToOrder call, missing from the brief)", () => {
    const e = offerRejectedEventSchema.parse({ offerId: "of1", orderId: "o1" });
    expect(e).toEqual({ offerId: "of1", orderId: "o1" });
  });

  it("parses location:driver with snake_case keys", () => {
    const e = driverLocationEventSchema.parse({
      livreur_id: "u1",
      lat: "5.556",
      lng: "-0.1969",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(e.livreurId).toBe("u1");
    expect(e.lat).toBe(5.556);
    expect(e.timestamp.toISOString()).toBe("2026-08-02T10:30:00.000Z");
  });

  it("parses delivery:status with snake_case keys", () => {
    const e = deliveryStatusEventSchema.parse({
      delivery_id: "d1",
      status: "picked_up",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(e.deliveryId).toBe("d1");
    expect(e.status).toBe("picked_up");
  });

  it("accepts a delivery:status value outside the DELIVERY_STATUSES wire enum", () => {
    // deliveries.service.ts's `transition()` calls emitDeliveryStatus(deliveryId, orderStatus)
    // with OrderStatus values (picked_up, driver_en_route, in_transit, delivered), not only
    // DeliveryStatus values (in_progress, completed, cancelled, disputed). Coercing `status`
    // through the DELIVERY_STATUSES wire enum would silently rewrite "in_transit" to the
    // enum's "in_progress" fallback and freeze the tracking screen's status text.
    const e = deliveryStatusEventSchema.parse({
      delivery_id: "d1",
      status: "in_transit",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(e.status).toBe("in_transit");
  });

  it("exposes the event names the gateway actually uses (backend/src/realtime/events.gateway.ts, realtime.service.ts, offers.service.ts)", () => {
    // server -> client
    expect(SOCKET_EVENTS.offerNew).toBe("offer:new");
    expect(SOCKET_EVENTS.offerAccepted).toBe("offer:accepted");
    expect(SOCKET_EVENTS.offerRejected).toBe("offer:rejected");
    expect(SOCKET_EVENTS.driverLocation).toBe("location:driver");
    expect(SOCKET_EVENTS.deliveryStatus).toBe("delivery:status");
    expect(SOCKET_EVENTS.chatMessage).toBe("chat:message");
    // client -> server
    expect(SOCKET_EVENTS.locationUpdate).toBe("location:update");
    // The brief called this "delivery:join"; the gateway's only handler that
    // unlocks a delivery room is @SubscribeMessage('chat:join') { delivery_id }.
    // There is no "delivery:join" event on the gateway at all.
    expect(SOCKET_EVENTS.joinDelivery).toBe("chat:join");
  });
});
