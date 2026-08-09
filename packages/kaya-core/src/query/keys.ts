/**
 * The cache keys both apps address their server state by.
 *
 * These live in `@kaya/core` rather than in an app for one reason: the
 * realtime bridge writes into the cache and the screens read out of it, and
 * they are written months apart. A bridge that writes `["delivery", id]` while
 * a screen reads `["deliveries", id]` produces no error anywhere -- the socket
 * event lands in a cache entry nothing is subscribed to, and the screen simply
 * never updates. That is the failure this module exists to make impossible.
 *
 * Nothing here imports react-query. A key is a plain readonly array, which is
 * all `QueryKey` is, so `@kaya/core` stays free of any UI-layer dependency
 * (the purity rule in the phase 1A plan).
 *
 * Hierarchy is deliberate: `offers(orderId)` is prefixed by `order(orderId)`,
 * so `invalidateQueries({ queryKey: keys.order(id) })` reaches the order and
 * its offers in one call, while `keys.offers(id)` alone reaches only the
 * offers. React Query matches keys by prefix, so the nesting *is* the
 * invalidation policy.
 */
export const queryKeys = {
  /** The signed-in user (`GET /auth/me`). */
  me: () => ["auth", "me"] as const,

  /** One order and everything nested under it. */
  orders: () => ["orders"] as const,
  orderList: (params?: Readonly<Record<string, unknown>>) =>
    params === undefined ? (["orders", "list"] as const) : (["orders", "list", params] as const),
  order: (orderId: string) => ["orders", orderId] as const,
  /** Offers on an order -- prefixed by `order(orderId)`, see the module doc. */
  offers: (orderId: string) => ["orders", orderId, "offers"] as const,
  /** Driver-side: published orders within a radius (`GET /orders/nearby`). */
  nearbyOrders: (params?: Readonly<Record<string, unknown>>) =>
    params === undefined
      ? (["orders", "nearby"] as const)
      : (["orders", "nearby", params] as const),

  /** One delivery and everything nested under it. */
  deliveries: () => ["deliveries"] as const,
  deliveryList: (params?: Readonly<Record<string, unknown>>) =>
    params === undefined
      ? (["deliveries", "list"] as const)
      : (["deliveries", "list", params] as const),
  delivery: (deliveryId: string) => ["deliveries", deliveryId] as const,
  /**
   * The last `delivery:status` event for a delivery, held separately from the
   * `Delivery` object itself.
   *
   * The event carries a status string, not a delivery, and that string is not
   * always a DeliveryStatus: `DeliveriesService.transition()` emits
   * OrderStatus values (picked_up, in_transit, ...) through the same channel
   * -- see the note on `deliveryStatusEventSchema` in ../realtime/events.ts.
   * Writing it onto the cached `Delivery` would either corrupt that object's
   * type or silently coerce a live "in_transit" to the enum fallback and
   * freeze the tracking screen. So it gets its own entry, and the tracking
   * screen reads both.
   */
  deliveryLiveStatus: (deliveryId: string) => ["deliveries", deliveryId, "liveStatus"] as const,
  /** Chat messages on a delivery. */
  messages: (deliveryId: string) => ["deliveries", deliveryId, "messages"] as const,

  /**
   * A driver's last known position.
   *
   * Keyed by driver, not by delivery, because the `location:driver` payload
   * carries `livreur_id` and no delivery id at all -- the gateway resolves the
   * target delivery server-side (see ../realtime/socket.ts's note on why this
   * event is exempt from the room filter). A tracking screen knows its
   * delivery's driver and reads this key for them.
   */
  driverLocation: (livreurId: string) => ["drivers", livreurId, "location"] as const,

  /** Notification inbox. */
  notifications: () => ["notifications"] as const,

  /** Driver earnings and stats. */
  driverStats: () => ["driver", "stats"] as const,
  transactions: () => ["transactions"] as const,
  withdrawals: () => ["withdrawals"] as const,
} as const;

/** The shape every key above produces: what react-query calls a `QueryKey`. */
export type KayaQueryKey = readonly unknown[];
