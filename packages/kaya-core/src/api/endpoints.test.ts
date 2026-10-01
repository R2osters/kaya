import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { KayaApi } from "./endpoints";
// Side-effect import for the `declare module "axios"` augmentation (adds
// `skipAuth`) — needed directly here because ts-jest's per-file language
// service does not otherwise pick it up through endpoints.ts's own import.
import "./client";

const build = () => {
  const http = axios.create({ baseURL: "http://localhost:3000/api/v1" });
  return { api: new KayaApi(http), mock: new MockAdapter(http) };
};

describe("KayaApi", () => {
  it("parses the current user", async () => {
    const { api, mock } = build();
    mock.onGet("/auth/me").reply(200, {
      id: "u1",
      fullName: "Ama Owusu",
      role: "livreur",
      countryCode: "TGO",
      balance: "1200.00",
    });

    const user = await api.me();
    expect(user.fullName).toBe("Ama Owusu");
    expect(user.balance).toBe(1200);
  });

  // CORRECTED: `orders.service.ts` `findMine()` wraps rows in
  // `{ data, page, limit, total }`; the original test (and implementation)
  // assumed a bare array, which the real backend never sends. See
  // `KayaApi.listOrders` for the fix and task-10-report.md finding #3.
  it("parses a paginated list of orders", async () => {
    const { api, mock } = build();
    mock.onGet("/orders").reply(200, {
      data: [{ id: "o1", status: "published", pickupLat: "5.5", pickupLng: "-0.2" }],
      page: 1,
      limit: 20,
      total: 1,
    });

    const orders = await api.listOrders();
    expect(orders.data).toHaveLength(1);
    expect(orders.data[0]?.pickup).toEqual({ lat: 5.5, lng: -0.2 });
    expect(orders.total).toBe(1);
  });

  // CORRECTED: `offers.service.ts` `acceptOffer()` returns
  // `{ order, delivery, offer }` from the acceptance transaction, not a bare
  // `Delivery`. See `KayaApi.acceptOffer` and task-10-report.md finding #6.
  it("interpolates path parameters and unwraps delivery from acceptOffer's {order, delivery, offer}", async () => {
    const { api, mock } = build();
    mock.onPost("/offers/of-42/accept").reply(200, {
      order: { id: "o1", status: "accepted" },
      delivery: {
        id: "d1",
        orderId: "o1",
        livreurId: "u1",
        status: "in_progress",
        clientPaymentStatus: "escrow_held",
      },
      offer: { id: "of-42", status: "accepted" },
    });

    const delivery = await api.acceptOffer("of-42");
    expect(delivery.id).toBe("d1");
  });

  it("sends login with skipAuth so no bearer header is attached", async () => {
    const { api, mock } = build();
    let skipped: boolean | undefined;
    mock.onPost("/auth/login").reply((cfg) => {
      // `cfg` is typed as axios's `AxiosRequestConfig`, augmented elsewhere
      // with `skipAuth` (see client.ts). ts-jest's per-file language service
      // does not always resolve that ambient merge for a contextually-typed
      // callback parameter (confirmed as a test-runner-only quirk: `tsc
      // --noEmit` on the whole project reports zero errors here), so the
      // property is read through an explicit cast rather than relying on it.
      skipped = (cfg as { skipAuth?: boolean }).skipAuth;
      return [200, { challengeId: "ch1" }];
    });

    const challenge = await api.login({ identifier: "+233201234567", password: "x" });
    expect(challenge.challengeId).toBe("ch1");
    expect(skipped).toBe(true);
  });

  it("routes a new social email to the wizard outcome", async () => {
    const { api, mock } = build();
    mock.onPost("/auth/social").reply(200, {
      isNewAccount: true,
      socialDraftToken: "tok",
      email: "new@example.com",
    });

    const outcome = await api.socialLogin({ provider: "google", idToken: "t" });
    expect(outcome.kind).toBe("signup_required");
  });

  // NOTE: the brief's endpoint table lists this path as "/orders/calculate-price",
  // but the Dart client (PricingApi.quote) and the backend controller
  // (backend/src/orders/pricing.controller.ts, @Controller('calculate-price'))
  // both hit "/calculate-price" with no "/orders" prefix. The Dart/backend win;
  // this test and the implementation use the corrected path.
  it("parses a price quote", async () => {
    const { api, mock } = build();
    mock.onGet("/calculate-price").reply(200, {
      countryCode: "GHA",
      distanceKm: "6.2",
      minPrice: "24.00",
      currency: "GHS",
      pricePerKm: "1",
      basePickupFee: "2",
    });

    const quote = await api.calculatePrice({
      pickupLat: 5.5,
      pickupLng: -0.2,
      deliveryLat: 5.6,
      deliveryLng: -0.16,
    });
    expect(quote.minPrice).toBe(24);
    expect(quote.distanceKm).toBe(6.2);
  });

  // --- Corrections against the Dart client / backend controllers ------------

  it("updates the profile via PUT, not PATCH", async () => {
    const { api, mock } = build();
    mock.onPut("/auth/profile").reply(200, {
      id: "u1",
      fullName: "New Name",
      role: "client",
      countryCode: "GHA",
    });

    const user = await api.updateProfile({ fullName: "New Name" });
    expect(user.fullName).toBe("New Name");
  });

  it("logs out with the refresh token in the body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/auth/logout").reply((cfg) => {
      sentBody = cfg.data;
      return [200, {}];
    });

    await api.logout({ refreshToken: "rt-1" });
    expect(JSON.parse(sentBody as string)).toEqual({ refreshToken: "rt-1" });
  });

  it("marks a message read at /messages/:id/read (PUT), not nested under the delivery", async () => {
    const { api, mock } = build();
    mock.onPut("/messages/m1/read").reply(200, {});

    await expect(api.markMessageRead("d1", "m1")).resolves.toBeUndefined();
  });

  it("lists ratings via /users/:id/ratings, not /ratings?userId=", async () => {
    const { api, mock } = build();
    mock
      .onGet("/users/u1/ratings")
      .reply(200, { page: "2", limit: "20", average: "4.5", count: "2", ratings: [] });

    const summary = await api.listRatings("u1");
    expect(summary.average).toBe(4.5);
    // The list is paginated; without page and limit a caller cannot fetch the
    // next page of a driver's ratings.
    expect(summary.page).toBe(2);
    expect(summary.limit).toBe(20);
  });

  it("marks a notification read via PUT, not POST", async () => {
    const { api, mock } = build();
    mock.onPut("/notifications/n1/read").reply(200, {});

    await expect(api.markNotificationRead("n1")).resolves.toBeUndefined();
  });

  it("tolerates a non-array response for a list endpoint", async () => {
    const { api, mock } = build();
    mock.onGet("/driver/withdrawals").reply(200, { unexpected: "shape" });

    const withdrawals = await api.listWithdrawals();
    expect(withdrawals).toEqual([]);
  });

  // --- Remaining auth methods -------------------------------------------

  it("registers with skipAuth and posts the body to /auth/register", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    let skipped: boolean | undefined;
    mock.onPost("/auth/register").reply((cfg) => {
      sentBody = cfg.data;
      skipped = (cfg as { skipAuth?: boolean }).skipAuth;
      return [
        200,
        {
          user: { id: "u1", fullName: "New User", role: "client", countryCode: "GHA" },
          accessToken: "a1",
          refreshToken: "r1",
        },
      ];
    });

    const result = await api.register({ email: "a@b.com", password: "x" });
    expect(JSON.parse(sentBody as string)).toEqual({ email: "a@b.com", password: "x" });
    expect(skipped).toBe(true);
    expect(result.user?.fullName).toBe("New User");
    expect(result.tokens.accessToken).toBe("a1");
  });

  it("redeems the login challenge at /auth/login/verify with skipAuth", async () => {
    const { api, mock } = build();
    let skipped: boolean | undefined;
    mock.onPost("/auth/login/verify").reply((cfg) => {
      skipped = (cfg as { skipAuth?: boolean }).skipAuth;
      return [
        200,
        {
          user: { id: "u1", fullName: "Ama", role: "client", countryCode: "GHA" },
          accessToken: "a1",
          refreshToken: "r1",
        },
      ];
    });

    const result = await api.loginVerify({ challengeId: "ch1", firebaseIdToken: "tok" });
    expect(skipped).toBe(true);
    expect(result.user?.id).toBe("u1");
  });

  it("logs in via OTP at /auth/login/otp with skipAuth", async () => {
    const { api, mock } = build();
    let skipped: boolean | undefined;
    mock.onPost("/auth/login/otp").reply((cfg) => {
      skipped = (cfg as { skipAuth?: boolean }).skipAuth;
      return [
        200,
        {
          user: { id: "u2", fullName: "Kwame", role: "livreur", countryCode: "TGO" },
          accessToken: "a2",
          refreshToken: "r2",
        },
      ];
    });

    const result = await api.loginOtp({ phone: "+228..." , firebaseIdToken: "tok" });
    expect(skipped).toBe(true);
    expect(result.user?.fullName).toBe("Kwame");
  });

  it("resets the password at /auth/password-reset with skipAuth, discarding the body", async () => {
    const { api, mock } = build();
    let skipped: boolean | undefined;
    mock.onPost("/auth/password-reset").reply((cfg) => {
      skipped = (cfg as { skipAuth?: boolean }).skipAuth;
      return [200, { success: true }];
    });

    await expect(
      api.passwordReset({ phone: "+228...", firebaseIdToken: "tok", newPassword: "x" }),
    ).resolves.toBeUndefined();
    expect(skipped).toBe(true);
  });

  // --- Orders -------------------------------------------------------------

  it("creates an order via POST /orders", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/orders").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "o1",
          clientId: "c1",
          pickupAddress: "Oxford St",
          pickupLat: "5.5",
          pickupLng: "-0.2",
          deliveryAddress: "Mango Lane",
          deliveryLat: "5.6",
          deliveryLng: "-0.16",
          status: "draft",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const order = await api.createOrder({ pickupAddress: "Oxford St" });
    expect(JSON.parse(sentBody as string)).toEqual({ pickupAddress: "Oxford St" });
    expect(order.id).toBe("o1");
    expect(order.pickup).toEqual({ lat: 5.5, lng: -0.2 });
  });

  // `orders.service.ts` `findOne()` spreads the order with an extra
  // `offersCount` (from a Prisma `_count` select) that `orderSchema` itself
  // has no field for; `getOrder` merges it in separately.
  it("gets an order by id and merges in offersCount", async () => {
    const { api, mock } = build();
    mock.onGet("/orders/o1").reply(200, {
      id: "o1",
      clientId: "c1",
      pickupAddress: "Oxford St",
      pickupLat: "5.5",
      pickupLng: "-0.2",
      deliveryAddress: "Mango Lane",
      deliveryLat: "5.6",
      deliveryLng: "-0.16",
      status: "published",
      createdAt: "2026-08-02T10:00:00.000Z",
      offersCount: 3,
    });

    const order = await api.getOrder("o1");
    expect(order.id).toBe("o1");
    expect(order.offersCount).toBe(3);
  });

  it("publishes an order via POST /orders/:id/publish", async () => {
    const { api, mock } = build();
    mock.onPost("/orders/o1/publish").reply(200, {
      id: "o1",
      status: "published",
      createdAt: "2026-08-02T10:00:00.000Z",
    });

    const order = await api.publishOrder("o1");
    expect(order.status).toBe("published");
  });

  // CORRECTED: `orders.service.ts` `nearby()` returns a dedicated shape
  // (with `distanceToPickupKm`), not `Order` rows. See task-10-report.md
  // finding #7.
  it("lists nearby orders with query params and parses distanceToPickupKm", async () => {
    const { api, mock } = build();
    let sentParams: unknown;
    mock.onGet("/orders/nearby").reply((cfg) => {
      sentParams = cfg.params;
      return [
        200,
        [
          {
            id: "o1",
            pickupAddress: "Oxford St",
            pickupLat: "5.5",
            pickupLng: "-0.2",
            deliveryAddress: "Mango Lane",
            deliveryLat: "5.6",
            deliveryLng: "-0.16",
            status: "published",
            distanceToPickupKm: "1.25",
            createdAt: "2026-08-02T10:00:00.000Z",
          },
        ],
      ];
    });

    const orders = await api.nearbyOrders({ lat: 5.5, lng: -0.2, radiusKm: 5 });
    expect(sentParams).toEqual({ lat: 5.5, lng: -0.2, radiusKm: 5 });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.distanceToPickupKm).toBe(1.25);
  });

  // --- Offers ---------------------------------------------------------------

  it("creates an offer via POST /orders/:orderId/offers", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/orders/o1/offers").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "of1",
          orderId: "o1",
          livreurId: "u1",
          proposedPrice: "28.00",
          minPrice: "24.00",
          status: "pending",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const offer = await api.createOffer("o1", { proposedPrice: 28 });
    expect(JSON.parse(sentBody as string)).toEqual({ proposedPrice: 28 });
    expect(offer.proposedPrice).toBe(28);
  });

  // CORRECTED: `offers.service.ts` `listOffers()` returns
  // `{ orderId, minPrice, offers: [...] }` with flattened bidder summaries,
  // not a bare array of `Offer`. See task-10-report.md finding #5.
  it("lists offers for an order in the backend's {orderId, minPrice, offers} shape", async () => {
    const { api, mock } = build();
    mock.onGet("/orders/o1/offers").reply(200, {
      orderId: "o1",
      minPrice: "24.00",
      offers: [
        {
          id: "of1",
          livreurId: "u1",
          livreurName: "Kwame Mensah",
          livreurPhoto: null,
          livreurRating: "4.80",
          livreurTotalDeliveries: "12",
          proposedPrice: "28.00",
          status: "pending",
          createdAt: "2026-08-02T10:00:00.000Z",
          expiresAt: null,
        },
      ],
    });

    const result = await api.listOffers("o1");
    expect(result.orderId).toBe("o1");
    expect(result.minPrice).toBe(24);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.livreurName).toBe("Kwame Mensah");
    expect(result.offers[0]?.proposedPrice).toBe(28);
  });

  it("rejects an offer via POST /offers/:id/reject and parses the returned Offer", async () => {
    const { api, mock } = build();
    mock.onPost("/offers/of1/reject").reply(200, {
      id: "of1",
      orderId: "o1",
      livreurId: "u1",
      status: "rejected",
      createdAt: "2026-08-02T10:00:00.000Z",
    });

    const offer = await api.rejectOffer("of1");
    expect(offer.status).toBe("rejected");
  });

  // --- Deliveries -------------------------------------------------------

  it("gets a delivery by id via GET /deliveries/:id", async () => {
    const { api, mock } = build();
    mock.onGet("/deliveries/d1").reply(200, {
      id: "d1",
      orderId: "o1",
      livreurId: "u1",
      status: "in_progress",
      clientPaymentStatus: "escrow_held",
      createdAt: "2026-08-02T10:00:00.000Z",
    });

    const delivery = await api.getDelivery("d1");
    expect(delivery.id).toBe("d1");
  });

  it("lists my deliveries via GET /deliveries", async () => {
    const { api, mock } = build();
    mock.onGet("/deliveries").reply(200, [
      {
        id: "d1",
        orderId: "o1",
        livreurId: "u1",
        status: "in_progress",
        clientPaymentStatus: "escrow_held",
        createdAt: "2026-08-02T10:00:00.000Z",
      },
    ]);

    const deliveries = await api.listDeliveries();
    expect(deliveries).toHaveLength(1);
  });

  it("starts a delivery via POST /deliveries/:id/start", async () => {
    const { api, mock } = build();
    mock.onPost("/deliveries/d1/start").reply(200, {
      id: "d1",
      orderId: "o1",
      livreurId: "u1",
      status: "in_progress",
      clientPaymentStatus: "escrow_held",
      startTime: "2026-08-02T10:05:00.000Z",
      createdAt: "2026-08-02T10:00:00.000Z",
    });

    const delivery = await api.startDelivery("d1");
    expect(delivery.startTime).not.toBeNull();
  });

  it("confirms pickup via POST /deliveries/:id/pickup with the photo body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/deliveries/d1/pickup").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "d1",
          orderId: "o1",
          livreurId: "u1",
          status: "in_progress",
          clientPaymentStatus: "escrow_held",
          pickupPhoto: "https://cdn/x.jpg",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const delivery = await api.pickupDelivery("d1", { photoUrl: "https://cdn/x.jpg" });
    expect(JSON.parse(sentBody as string)).toEqual({ photoUrl: "https://cdn/x.jpg" });
    expect(delivery.pickupPhoto).toBe("https://cdn/x.jpg");
  });

  it("moves to transit via POST /deliveries/:id/transit", async () => {
    const { api, mock } = build();
    mock.onPost("/deliveries/d1/transit").reply(200, {
      id: "d1",
      orderId: "o1",
      livreurId: "u1",
      status: "in_progress",
      clientPaymentStatus: "escrow_held",
      createdAt: "2026-08-02T10:00:00.000Z",
    });

    await expect(api.transitDelivery("d1")).resolves.toMatchObject({ id: "d1" });
  });

  it("confirms delivery via POST /deliveries/:id/confirm-delivery with the photo body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/deliveries/d1/confirm-delivery").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "d1",
          orderId: "o1",
          livreurId: "u1",
          status: "completed",
          clientPaymentStatus: "released",
          deliveryPhoto: "https://cdn/y.jpg",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const delivery = await api.confirmDelivery("d1", { photoUrl: "https://cdn/y.jpg" });
    expect(JSON.parse(sentBody as string)).toEqual({ photoUrl: "https://cdn/y.jpg" });
    expect(delivery.status).toBe("completed");
  });

  it("cancels a delivery via POST /deliveries/:id/cancel with an optional reason body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/deliveries/d1/cancel").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "d1",
          orderId: "o1",
          livreurId: "u1",
          status: "cancelled",
          clientPaymentStatus: "refunded",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const delivery = await api.cancelOrder("d1", { reason: "changed my mind" });
    expect(JSON.parse(sentBody as string)).toEqual({ reason: "changed my mind" });
    expect(delivery.status).toBe("cancelled");
  });

  // --- Payments -----------------------------------------------------------

  // CORRECTED: `payments.service.ts` `initialize()` also returns
  // `transactionId`, `amount`, `currency` and `gateway`; the original schema
  // silently dropped them. See task-10-report.md finding #2.
  it("initializes a payment via POST /payments/initialize and parses the full response", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/payments/initialize").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          transactionId: "tx1",
          reference: "KAYA-123",
          authorizationUrl: "https://checkout/x",
          amount: 50,
          currency: "GHS",
          gateway: "mock",
        },
      ];
    });

    const init = await api.initializePayment({ deliveryId: "d1" });
    expect(JSON.parse(sentBody as string)).toEqual({ deliveryId: "d1" });
    expect(init.transactionId).toBe("tx1");
    expect(init.amount).toBe(50);
    expect(init.currency).toBe("GHS");
    expect(init.gateway).toBe("mock");
  });

  // CRITICAL FIX (Finding 1): `payments.service.ts` `verify()` ends with
  // `return { reference, status: result.status }` — no delivery. The old
  // schema (`deliverySchema`) threw a ZodError on every real call. See
  // task-10-report.md finding #1.
  it("verifies a payment via POST /payments/verify and parses {reference, status}, not a Delivery", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/payments/verify").reply((cfg) => {
      sentBody = cfg.data;
      return [200, { reference: "KAYA-123", status: "success" }];
    });

    const result = await api.verifyPayment({ reference: "KAYA-123" });
    expect(JSON.parse(sentBody as string)).toEqual({ reference: "KAYA-123" });
    expect(result).toEqual({ reference: "KAYA-123", status: "success" });
  });

  it("does not throw when verifyPayment's response is missing a field", async () => {
    const { api, mock } = build();
    mock.onPost("/payments/verify").reply(200, { status: "pending" });

    await expect(api.verifyPayment({ reference: "KAYA-123" })).resolves.toEqual({
      reference: "",
      status: "pending",
    });
  });

  // --- Chat -----------------------------------------------------------------

  it("lists messages for a delivery via GET /deliveries/:id/messages", async () => {
    const { api, mock } = build();
    mock.onGet("/deliveries/d1/messages").reply(200, [
      {
        id: "m1",
        deliveryId: "d1",
        senderId: "u1",
        messageText: "On my way",
        createdAt: "2026-08-02T10:00:00.000Z",
      },
    ]);

    const messages = await api.listMessages("d1");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageText).toBe("On my way");
  });

  it("sends a message via POST /deliveries/:id/messages with the body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/deliveries/d1/messages").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "m1",
          deliveryId: "d1",
          senderId: "u1",
          messageText: "On my way",
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const message = await api.sendMessage("d1", { messageText: "On my way" });
    expect(JSON.parse(sentBody as string)).toEqual({ messageText: "On my way" });
    expect(message.messageText).toBe("On my way");
  });

  // --- Ratings --------------------------------------------------------------

  it("rates a delivery via POST /deliveries/:id/rate with the body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/deliveries/d1/rate").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "r1",
          deliveryId: "d1",
          fromUserId: "u1",
          toUserId: "u2",
          score: 5,
          createdAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const rating = await api.rateDelivery("d1", { toUserId: "u2", score: 5 });
    expect(JSON.parse(sentBody as string)).toEqual({ toUserId: "u2", score: 5 });
    expect(rating.score).toBe(5);
  });

  it("names a position via GET /geocoding/reverse, keeping the asked-about coordinate", async () => {
    const { api, mock } = build();
    mock.onGet("/geocoding/reverse").reply(200, {
      label: "Osu, Accra, Ghana",
      name: "Osu",
      city: "Accra",
      countryCode: "GH",
      lat: 5.5606,
      lng: -0.1824,
    });

    const found = await api.reverseGeocode({ lat: 5.5606, lng: -0.1824 });
    expect(found?.label).toBe("Osu, Accra, Ghana");
    expect(found?.lat).toBe(5.5606);
  });

  it("reads 'no address here' as null rather than as a failure", async () => {
    const { api, mock } = build();
    mock.onGet("/geocoding/reverse").reply(200, null);

    await expect(api.reverseGeocode({ lat: 0, lng: 0 })).resolves.toBeNull();
  });

  // --- Live supply -------------------------------------------------------

  it("reads nearby driver positions via GET /drivers/nearby", async () => {
    const { api, mock } = build();
    mock.onGet("/drivers/nearby").reply(200, {
      drivers: [
        { lat: 5.5606, lng: -0.1824 },
        { lat: "5.6037", lng: "-0.187" },
      ],
    });

    await expect(api.nearbyDrivers({ lat: 5.56, lng: -0.18 })).resolves.toEqual([
      { lat: 5.5606, lng: -0.1824 },
      { lat: 5.6037, lng: -0.187 },
    ]);
  });

  it("drops a driver row missing a coordinate rather than pinning it at (0,0)", async () => {
    // (0, 0) is in the Gulf of Guinea: on a map of Accra that reads as a
    // driver a few hundred kilometres out to sea.
    const { api, mock } = build();
    mock.onGet("/drivers/nearby").reply(200, {
      drivers: [{ lat: 5.56 }, { lng: -0.18 }, {}, { lat: 5.5606, lng: -0.1824 }],
    });

    await expect(api.nearbyDrivers({ lat: 5.56, lng: -0.18 })).resolves.toEqual([
      { lat: 5.5606, lng: -0.1824 },
    ]);
  });

  it("reads an empty or malformed answer as no drivers, not as a failure", async () => {
    const { api, mock } = build();
    mock.onGet("/drivers/nearby").reply(200, {});

    await expect(api.nearbyDrivers({ lat: 5.56, lng: -0.18 })).resolves.toEqual([]);
  });

  // --- Country configuration --------------------------------------------

  it("reads a country's tariff card via GET /country-configs/:code, tiers collapsed to an array", async () => {
    const { api, mock } = build();
    mock.onGet("/country-configs/GHA").reply(200, {
      countryCode: "GHA",
      countryName: "Ghana",
      currencyCode: "GHS",
      currencySymbol: "₵",
      pricePerKm: 2.5,
      basePickupFee: 5,
      commissionTier1: 0.2,
      commissionTier2: 0.15,
      commissionTier3: 0.12,
      commissionTier4: 0.09,
      litigationFee: 1,
      searchRadiusKm: 5,
      withdrawalMethods: ["momo", "bank_transfer"],
      momoProviders: ["mtn", "vodafone"],
    });

    const config = await api.countryConfig("GHA");
    expect(config.currency).toBe("GHS");
    expect(config.commissionTiers).toEqual([0.2, 0.15, 0.12, 0.09]);
    expect(config.litigationFee).toBe(1);
    expect(config.withdrawalMethods).toEqual(["momo", "bank_transfer"]);
  });

  it("lists every country configuration", async () => {
    const { api, mock } = build();
    mock.onGet("/country-configs").reply(200, [
      { countryCode: "GHA", currencyCode: "GHS" },
      { countryCode: "TGO", currencyCode: "XOF" },
    ]);

    const configs = await api.countryConfigs();
    expect(configs.map((c) => c.currency)).toEqual(["GHS", "XOF"]);
  });

  // --- Driver status ----------------------------------------------------

  it("goes online via POST /driver/status and reports the flag as it now stands", async () => {
    const { api, mock } = build();
    mock.onPost("/driver/status").reply(200, { isOnline: true });

    await expect(api.setDriverStatus(true)).resolves.toEqual({ isOnline: true });
    expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({ online: true });
  });

  it("goes offline through the same endpoint", async () => {
    const { api, mock } = build();
    mock.onPost("/driver/status").reply(200, { isOnline: false });

    await expect(api.setDriverStatus(false)).resolves.toEqual({ isOnline: false });
    expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({ online: false });
  });

  it("reads a missing flag as offline rather than throwing", async () => {
    // Being wrongly told you are online is the worse failure: the driver
    // waits for work that will never be offered to them.
    const { api, mock } = build();
    mock.onPost("/driver/status").reply(200, {});

    await expect(api.setDriverStatus(true)).resolves.toEqual({ isOnline: false });
  });

  // --- Driver money -----------------------------------------------------

  // CORRECTED: `driver.service.ts` `getBalance()` also returns
  // `recentTransactions`; the original schema dropped it. See
  // task-10-report.md finding #4.
  it("gets the driver balance via GET /driver/balance including recentTransactions", async () => {
    const { api, mock } = build();
    mock.onGet("/driver/balance").reply(200, {
      balance: "340.00",
      currency: "GHS",
      recentTransactions: [
        { id: "t1", type: "driver_payout", amount: "24.00", currency: "GHS", status: "completed", createdAt: "2026-08-02T10:00:00.000Z" },
      ],
    });

    const balance = await api.driverBalance();
    expect(balance.balance).toBe(340);
    expect(balance.recentTransactions).toHaveLength(1);
    expect(balance.recentTransactions[0]?.amount).toBe(24);
  });

  // CRITICAL FIX: `driver.service.ts` `getEarnings()` returns per-delivery
  // payout rows, not `Transaction` rows. See task-10-report.md finding #9.
  it("lists driver earnings via GET /driver/earnings in the backend's per-delivery shape", async () => {
    const { api, mock } = build();
    mock.onGet("/driver/earnings").reply(200, [
      {
        deliveryId: "d1",
        date: "2026-08-02T12:00:00.000Z",
        clientName: "Ama Owusu",
        basePrice: "50.00",
        commissionRate: "0.15",
        commissionAmount: "7.50",
        litigationFee: "1.00",
        netEarnings: "41.50",
      },
    ]);

    const earnings = await api.driverEarnings();
    expect(earnings).toHaveLength(1);
    expect(earnings[0]?.clientName).toBe("Ama Owusu");
    expect(earnings[0]?.netEarnings).toBe(41.5);
  });

  // CRITICAL FIX: `driver.service.ts` `getStats()` returns
  // `dailyDeliveries`/`totalDeliveries`/`todayEarnings`/etc, not the invented
  // field names the old schema declared. See task-10-report.md finding #8.
  it("gets driver stats via GET /driver/stats with the backend's real field names", async () => {
    const { api, mock } = build();
    mock.onGet("/driver/stats").reply(200, {
      dailyDeliveries: 6,
      totalDeliveries: 120,
      balance: "340.00",
      currency: "GHS",
      currentCommissionRate: "0.20",
      nextCommissionRate: "0.15",
      nextTierThreshold: 7,
      todayEarnings: "180.00",
    });

    const stats = await api.driverStats();
    expect(stats.dailyDeliveries).toBe(6);
    expect(stats.totalDeliveries).toBe(120);
    expect(stats.todayEarnings).toBe(180);
    expect(stats.nextTierThreshold).toBe(7);
  });

  it("requests a withdrawal via POST /driver/withdraw with the body", async () => {
    const { api, mock } = build();
    let sentBody: unknown;
    mock.onPost("/driver/withdraw").reply((cfg) => {
      sentBody = cfg.data;
      return [
        200,
        {
          id: "w1",
          livreurId: "u1",
          amount: "100.00",
          method: "momo",
          status: "pending",
          feeAmount: "2.00",
          requestedAt: "2026-08-02T10:00:00.000Z",
        },
      ];
    });

    const withdrawal = await api.requestWithdrawal({
      amount: 100,
      method: "momo",
      accountDetails: { phone: "+233...", provider: "mtn" },
    });
    expect(JSON.parse(sentBody as string)).toEqual({
      amount: 100,
      method: "momo",
      accountDetails: { phone: "+233...", provider: "mtn" },
    });
    expect(withdrawal.amount).toBe(100);
  });

  // --- Notifications ------------------------------------------------------

  // CORRECTED: `notifications.service.ts` `list()` wraps rows in
  // `{ data, page, limit, total, unread }`, the same paginated-envelope bug
  // as listOrders, plus an `unread` badge count. See task-10-report.md
  // finding #10.
  it("lists notifications via GET /notifications, unwrapping the paginated envelope", async () => {
    const { api, mock } = build();
    let sentParams: unknown;
    mock.onGet("/notifications").reply((cfg) => {
      sentParams = cfg.params;
      return [
        200,
        {
          data: [
            {
              id: "n1",
              type: "payment",
              title: "Payment secured",
              body: "Your payment is held in escrow.",
              createdAt: "2026-08-02T10:00:00.000Z",
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          unread: 1,
        },
      ];
    });

    const page = await api.listNotifications({ unreadOnly: true });
    expect(sentParams).toEqual({ unreadOnly: true });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.title).toBe("Payment secured");
    expect(page.unread).toBe(1);
  });

  it("marks all notifications read via POST /notifications/read-all", async () => {
    const { api, mock } = build();
    mock.onPost("/notifications/read-all").reply(200, { updated: 3 });

    await expect(api.markAllNotificationsRead()).resolves.toBeUndefined();
  });
  describe("searchAddresses", () => {
    const OSU = {
      label: "Osu, Accra, Ghana",
      name: "Osu",
      city: "Accra",
      countryCode: "GH",
      lat: 5.5605929,
      lng: -0.1824391,
    };

    it("parses the suggestion list", async () => {
      const { api, mock } = build();
      mock.onGet("/geocoding/search").reply(200, [OSU]);

      const results = await api.searchAddresses({ q: "Osu" });

      expect(results).toEqual([OSU]);
    });

    it("passes the query, country, language and limit through as params", async () => {
      const { api, mock } = build();
      mock.onGet("/geocoding/search").reply(200, []);

      await api.searchAddresses({ q: "Osu", countryCode: "GH", language: "fr", limit: 5 });

      expect(mock.history.get[0]?.params).toEqual({
        q: "Osu",
        countryCode: "GH",
        language: "fr",
        limit: 5,
      });
    });

    it("coerces string coordinates, which is how a JSON backend may send them", async () => {
      const { api, mock } = build();
      mock.onGet("/geocoding/search").reply(200, [{ ...OSU, lat: "5.5605929", lng: "-0.1824391" }]);

      const [first] = await api.searchAddresses({ q: "Osu" });

      // These are a money field in everything but name: the price is
      // distance_km x price_per_km, and distance comes from these two numbers.
      expect(first?.lat).toBe(5.5605929);
      expect(first?.lng).toBe(-0.1824391);
    });

    it("degrades an unexpected envelope to an empty list rather than throwing", async () => {
      const { api, mock } = build();
      mock.onGet("/geocoding/search").reply(200, { data: [OSU] });

      await expect(api.searchAddresses({ q: "Osu" })).resolves.toEqual([]);
    });
  });
});
