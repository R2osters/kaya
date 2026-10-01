import { NOTIFICATION_TYPES } from "@kaya/core";
import { notificationRoute } from "./notificationRoute";

describe("notificationRoute (driver)", () => {
  it("opens the run itself for a delivery, not a map to watch", () => {
    // The same `type` means a different screen on each side: the client
    // watches, the driver executes.
    expect(notificationRoute("delivery", { deliveryId: "d-1" })).toBe("/delivery/d-1");
  });

  it("opens the run for payment news, which is what unblocks starting it", () => {
    // /start refuses until escrow is held, so "payment secured" is the push
    // that means "you can go now".
    expect(notificationRoute("payment", { deliveryId: "d-1" })).toBe("/delivery/d-1");
  });

  it("opens the bid screen when work is published nearby", () => {
    expect(notificationRoute("order", { orderId: "o-1" })).toBe("/propose/o-1");
  });

  it("opens the bid screen for news about an offer", () => {
    expect(notificationRoute("offer", { orderId: "o-1" })).toBe("/propose/o-1");
  });

  it("sends a withdrawal update to earnings, where its status lives", () => {
    expect(notificationRoute("withdrawal", {})).toBe("/(tabs)/earnings");
  });

  it("returns null rather than a broken route when the id is absent", () => {
    expect(notificationRoute("delivery", {})).toBeNull();
    expect(notificationRoute("order", {})).toBeNull();
  });

  it("answers for every notification type the wire can produce", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(() => notificationRoute(type, { deliveryId: "d", orderId: "o" })).not.toThrow();
    }
  });
});
