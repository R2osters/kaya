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

  it("parses a list of orders", async () => {
    const { api, mock } = build();
    mock.onGet("/orders").reply(200, [
      { id: "o1", status: "published", pickupLat: "5.5", pickupLng: "-0.2" },
    ]);

    const orders = await api.listOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.pickup).toEqual({ lat: 5.5, lng: -0.2 });
  });

  it("interpolates path parameters", async () => {
    const { api, mock } = build();
    mock.onPost("/offers/of-42/accept").reply(200, {
      id: "d1",
      orderId: "o1",
      livreurId: "u1",
      status: "in_progress",
      clientPaymentStatus: "escrow_held",
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
    mock.onGet("/users/u1/ratings").reply(200, { average: "4.5", count: "2", ratings: [] });

    const summary = await api.listRatings("u1");
    expect(summary.average).toBe(4.5);
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
});
