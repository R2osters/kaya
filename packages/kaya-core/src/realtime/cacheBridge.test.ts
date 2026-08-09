import { messageSchema, type Message } from "../models/message";
import { queryKeys } from "../query/keys";
import { applyRealtimeEvent, type RealtimeCache } from "./cacheBridge";

/**
 * A cache that records what was asked of it, and actually applies the writes,
 * so a test can assert both the policy (write vs. invalidate) and the value
 * that landed.
 */
function fakeCache() {
  const store = new Map<string, unknown>();
  const writes: unknown[][] = [];
  const invalidations: unknown[][] = [];

  const cache: RealtimeCache = {
    setQueryData: (key, updater) => {
      writes.push([...key]);
      store.set(JSON.stringify(key), updater(store.get(JSON.stringify(key)) as never));
    },
    invalidateQueries: (key) => {
      invalidations.push([...key]);
    },
  };

  return {
    cache,
    writes,
    invalidations,
    read: <T>(key: readonly unknown[]): T | undefined => store.get(JSON.stringify(key)) as T,
    seed: (key: readonly unknown[], value: unknown) => store.set(JSON.stringify(key), value),
  };
}

function message(overrides: Record<string, unknown> = {}): Message {
  return messageSchema.parse({
    id: "m-1",
    delivery_id: "d-1",
    sender_id: "u-1",
    receiver_id: "u-2",
    message_text: "Je suis en route",
    image_url: null,
    is_read: false,
    created_at: "2026-08-09T10:00:00.000Z",
    ...overrides,
  });
}

describe("applyRealtimeEvent", () => {
  describe("location:driver", () => {
    it("writes the position straight into the cache and never invalidates", () => {
      const { cache, writes, invalidations, read } = fakeCache();
      const payload = {
        livreurId: "livreur-7",
        lat: 5.6037,
        lng: -0.187,
        timestamp: new Date("2026-08-09T10:00:00.000Z"),
      };

      applyRealtimeEvent(cache, "location:driver", payload);

      expect(writes).toEqual([[...queryKeys.driverLocation("livreur-7")]]);
      // The whole point: a ~5s cadence must cost zero network requests.
      expect(invalidations).toEqual([]);
      expect(read(queryKeys.driverLocation("livreur-7"))).toEqual(payload);
    });

    it("overwrites the previous position rather than accumulating", () => {
      const { cache, read } = fakeCache();
      const at = (lat: number) => ({
        livreurId: "livreur-7",
        lat,
        lng: -0.187,
        timestamp: new Date(),
      });

      applyRealtimeEvent(cache, "location:driver", at(5.6));
      applyRealtimeEvent(cache, "location:driver", at(5.7));

      expect(read<{ lat: number }>(queryKeys.driverLocation("livreur-7"))?.lat).toBe(5.7);
    });

    it("keeps two drivers in separate entries", () => {
      const { cache, read } = fakeCache();

      applyRealtimeEvent(cache, "location:driver", {
        livreurId: "a",
        lat: 1,
        lng: 1,
        timestamp: new Date(),
      });
      applyRealtimeEvent(cache, "location:driver", {
        livreurId: "b",
        lat: 2,
        lng: 2,
        timestamp: new Date(),
      });

      expect(read<{ lat: number }>(queryKeys.driverLocation("a"))?.lat).toBe(1);
      expect(read<{ lat: number }>(queryKeys.driverLocation("b"))?.lat).toBe(2);
    });
  });

  describe("chat:message", () => {
    it("appends to an empty thread", () => {
      const { cache, read, invalidations } = fakeCache();

      applyRealtimeEvent(cache, "chat:message", message());

      expect(read<Message[]>(queryKeys.messages("d-1"))).toHaveLength(1);
      expect(invalidations).toEqual([]);
    });

    it("appends to an existing thread", () => {
      const { cache, seed, read } = fakeCache();
      seed(queryKeys.messages("d-1"), [message({ id: "m-0" })]);

      applyRealtimeEvent(cache, "chat:message", message({ id: "m-1" }));

      expect(read<Message[]>(queryKeys.messages("d-1"))?.map((m) => m.id)).toEqual(["m-0", "m-1"]);
    });

    it("replaces rather than duplicates a message already in the thread", () => {
      // The gateway rebroadcasts to the whole delivery room including the
      // sender, so the sender's own message comes back over the socket after
      // the REST POST already put it in the cache.
      const { cache, seed, read } = fakeCache();
      seed(queryKeys.messages("d-1"), [message({ id: "m-1", is_read: false })]);

      applyRealtimeEvent(cache, "chat:message", message({ id: "m-1", is_read: true }));

      const thread = read<Message[]>(queryKeys.messages("d-1"));
      expect(thread).toHaveLength(1);
      expect(thread?.[0]?.isRead).toBe(true);
    });

    it("orders by createdAt, not by arrival", () => {
      const { cache, seed, read } = fakeCache();
      seed(queryKeys.messages("d-1"), [
        message({ id: "late", created_at: "2026-08-09T10:05:00.000Z" }),
      ]);

      applyRealtimeEvent(
        cache,
        "chat:message",
        message({ id: "early", created_at: "2026-08-09T10:01:00.000Z" }),
      );

      expect(read<Message[]>(queryKeys.messages("d-1"))?.map((m) => m.id)).toEqual([
        "early",
        "late",
      ]);
    });

    it("writes to the thread of the message's own delivery", () => {
      const { cache, read } = fakeCache();

      applyRealtimeEvent(cache, "chat:message", message({ delivery_id: "d-99" }));

      expect(read<Message[]>(queryKeys.messages("d-99"))).toHaveLength(1);
      expect(read<Message[]>(queryKeys.messages("d-1"))).toBeUndefined();
    });
  });

  describe("delivery:status", () => {
    it("writes the live status and invalidates the delivery itself", () => {
      const { cache, writes, invalidations, read } = fakeCache();
      const payload = {
        deliveryId: "d-1",
        status: "in_transit",
        timestamp: new Date("2026-08-09T10:00:00.000Z"),
      };

      applyRealtimeEvent(cache, "delivery:status", payload);

      expect(writes).toEqual([[...queryKeys.deliveryLiveStatus("d-1")]]);
      expect(invalidations).toEqual([[...queryKeys.delivery("d-1")]]);
      expect(read(queryKeys.deliveryLiveStatus("d-1"))).toEqual(payload);
    });

    it("keeps an order-lifecycle status verbatim rather than coercing it", () => {
      // transition() emits OrderStatus values through this channel; coercing
      // them to the DeliveryStatus enum would freeze the tracking screen.
      const { cache, read } = fakeCache();

      applyRealtimeEvent(cache, "delivery:status", {
        deliveryId: "d-1",
        status: "picked_up",
        timestamp: new Date(),
      });

      expect(read<{ status: string }>(queryKeys.deliveryLiveStatus("d-1"))?.status).toBe(
        "picked_up",
      );
    });
  });

  describe("offer events", () => {
    it("offer:new invalidates the order's offers and writes nothing", () => {
      const { cache, writes, invalidations } = fakeCache();

      applyRealtimeEvent(cache, "offer:new", {
        offerId: "o-1",
        orderId: "order-1",
        livreurId: "livreur-1",
        proposedPrice: 25,
      });

      // A four-field payload is not an Offer; writing it would render a
      // half-built row.
      expect(writes).toEqual([]);
      expect(invalidations).toEqual([[...queryKeys.offers("order-1")]]);
    });

    it("offer:rejected invalidates the order's offers", () => {
      const { cache, invalidations } = fakeCache();

      applyRealtimeEvent(cache, "offer:rejected", { offerId: "o-1", orderId: "order-1" });

      expect(invalidations).toEqual([[...queryKeys.offers("order-1")]]);
    });

    it("offer:accepted invalidates the whole order and the deliveries list", () => {
      const { cache, invalidations } = fakeCache();

      applyRealtimeEvent(cache, "offer:accepted", {
        offerId: "o-1",
        orderId: "order-1",
        deliveryId: "d-1",
        livreurId: "livreur-1",
      });

      expect(invalidations).toEqual([
        [...queryKeys.order("order-1")],
        [...queryKeys.deliveries()],
      ]);
    });

    it("offer:accepted's order key prefixes the offers key, so offers are covered too", () => {
      const orderKey = queryKeys.order("order-1");
      const offersKey = queryKeys.offers("order-1");

      expect(offersKey.slice(0, orderKey.length)).toEqual([...orderKey]);
    });
  });
});
