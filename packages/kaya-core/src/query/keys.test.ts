import { queryKeys } from "./keys";

describe("queryKeys", () => {
  it("prefixes offers with the order they belong to", () => {
    // This is the whole point of the hierarchy: invalidating the order must
    // also reach its offers, which react-query decides by prefix match.
    const order = queryKeys.order("order-1");
    const offers = queryKeys.offers("order-1");

    expect(offers.slice(0, order.length)).toEqual([...order]);
  });

  it("prefixes messages, live status and the delivery itself consistently", () => {
    const delivery = queryKeys.delivery("d-1");

    expect(queryKeys.messages("d-1").slice(0, delivery.length)).toEqual([...delivery]);
    expect(queryKeys.deliveryLiveStatus("d-1").slice(0, delivery.length)).toEqual([...delivery]);
  });

  it("keeps two different orders in separate cache entries", () => {
    expect(queryKeys.order("a")).not.toEqual(queryKeys.order("b"));
    expect(queryKeys.offers("a")).not.toEqual(queryKeys.offers("b"));
  });

  it("keys driver location by driver, not by delivery", () => {
    // The location:driver payload has no delivery id -- see the key's own doc
    // and ../realtime/events.ts. A key shaped by delivery would be unfillable.
    expect(queryKeys.driverLocation("livreur-7")).toEqual(["drivers", "livreur-7", "location"]);
  });

  it("gives a list with params a different entry from the unparameterised list", () => {
    expect(queryKeys.orderList()).not.toEqual(queryKeys.orderList({ status: "published" }));
    expect(queryKeys.deliveryList()).not.toEqual(queryKeys.deliveryList({ page: 2 }));
    expect(queryKeys.nearbyOrders()).not.toEqual(queryKeys.nearbyOrders({ radiusKm: 5 }));
  });

  it("nests every order-scoped list under the orders root so one call clears them all", () => {
    const root = queryKeys.orders();

    for (const key of [
      queryKeys.orderList(),
      queryKeys.orderList({ status: "published" }),
      queryKeys.order("x"),
      queryKeys.offers("x"),
      queryKeys.nearbyOrders(),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root]);
    }
  });

  it("nests every delivery-scoped key under the deliveries root", () => {
    const root = queryKeys.deliveries();

    for (const key of [
      queryKeys.deliveryList(),
      queryKeys.delivery("x"),
      queryKeys.messages("x"),
      queryKeys.deliveryLiveStatus("x"),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root]);
    }
  });

  it("returns a fresh array each call, so a caller cannot mutate a shared key", () => {
    const first = queryKeys.order("x") as unknown as string[];
    first.push("mutated");

    expect(queryKeys.order("x")).toEqual(["orders", "x"]);
  });
  describe("priceQuote", () => {
    const OSU = { lat: 5.5606, lng: -0.1824 };
    const TEMA = { lat: 5.6698, lng: -0.0166 };

    it("keys on both points, so a different pair is a different quote", () => {
      expect(queryKeys.priceQuote(OSU, TEMA)).not.toEqual(queryKeys.priceQuote(TEMA, OSU));
    });

    it("returns the same key for the same pair, so moving a pin back is cached", () => {
      expect(queryKeys.priceQuote(OSU, TEMA)).toEqual(queryKeys.priceQuote(OSU, TEMA));
    });

    it("rounds to about a metre, so a map drag is one entry rather than hundreds", () => {
      // A drag emits positions differing in the twelfth decimal. Keying on
      // those raw values makes every frame its own cache entry and request.
      const dragged = { lat: 5.56060000001, lng: -0.18240000002 };

      expect(queryKeys.priceQuote(dragged, TEMA)).toEqual(queryKeys.priceQuote(OSU, TEMA));
    });

    it("still separates points a real distance apart", () => {
      const elsewhere = { lat: 5.5616, lng: -0.1824 };

      expect(queryKeys.priceQuote(elsewhere, TEMA)).not.toEqual(queryKeys.priceQuote(OSU, TEMA));
    });

    it("has a distinct key while either point is still unset", () => {
      expect(queryKeys.priceQuote(null, TEMA)).not.toEqual(queryKeys.priceQuote(OSU, TEMA));
      expect(queryKeys.priceQuote(null, null)).not.toEqual(queryKeys.priceQuote(OSU, null));
    });
  });

  describe("driver money", () => {
    it("nests balance, earnings and stats under one prefix", () => {
      // Settling a delivery moves all three at once. The nesting is what lets
      // that be a single invalidation instead of three that can drift apart.
      const prefix = queryKeys.driver();

      for (const key of [
        queryKeys.driverBalance(),
        queryKeys.driverEarnings(),
        queryKeys.driverStats(),
      ]) {
        expect(key.slice(0, prefix.length)).toEqual([...prefix]);
      }
    });

    it("keeps the three apart from each other", () => {
      expect(queryKeys.driverBalance()).not.toEqual(queryKeys.driverEarnings());
      expect(queryKeys.driverEarnings()).not.toEqual(queryKeys.driverStats());
    });
  });
});
