import { NOTIFICATION_TYPES } from "@kaya/core";
import { notificationRoute } from "./notificationRoute";

describe("notificationRoute (client)", () => {
  it("opens the live map for a delivery", () => {
    expect(notificationRoute("delivery", { deliveryId: "d-1" })).toBe("/tracking/d-1");
  });

  it("opens the same map for money news about that delivery", () => {
    // The tracking screen carries the payment state; sending someone to a
    // list to read "payment secured" would cost them a tap for nothing.
    expect(notificationRoute("payment", { deliveryId: "d-1" })).toBe("/tracking/d-1");
  });

  it("opens the order's offers when a bid arrives -- that is where a client acts", () => {
    expect(notificationRoute("offer", { orderId: "o-1", offerId: "of-1" })).toBe("/offers/o-1");
  });

  it("opens the offers for an order update too", () => {
    expect(notificationRoute("order", { orderId: "o-1" })).toBe("/offers/o-1");
  });

  it("reads a scheduled-order reminder's own id key", () => {
    // OrdersScheduler sends `reminderFor`, not `orderId`. Missing that would
    // drop every reminder tap into the notification list.
    expect(notificationRoute("order", { reminderFor: "o-9" })).toBe("/offers/o-9");
  });

  it("returns null rather than a broken route when the id is absent", () => {
    expect(notificationRoute("delivery", {})).toBeNull();
    expect(notificationRoute("offer", {})).toBeNull();
  });

  it("returns null for what this side cannot open", () => {
    expect(notificationRoute("withdrawal", {})).toBeNull();
    expect(notificationRoute("system", {})).toBeNull();
  });

  it("answers for every notification type the wire can produce", () => {
    // A type added to the enum without a case here would stop compiling; this
    // is the runtime half of that guarantee.
    for (const type of NOTIFICATION_TYPES) {
      expect(() => notificationRoute(type, { deliveryId: "d", orderId: "o" })).not.toThrow();
    }
  });
});
