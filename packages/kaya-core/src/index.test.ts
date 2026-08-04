import * as core from "./index";

describe("@kaya/core public surface", () => {
  it("exports the money helpers", () => {
    expect(typeof core.roundMoney).toBe("function");
    expect(typeof core.formatMoney).toBe("function");
    expect(typeof core.commissionRateForDeliveryNumber).toBe("function");
    expect(typeof core.commissionPreview).toBe("function");
  });

  it("exports the model schemas", () => {
    expect(core.userSchema).toBeDefined();
    expect(core.orderSchema).toBeDefined();
    expect(core.offerSchema).toBeDefined();
    expect(core.deliverySchema).toBeDefined();
    expect(core.withdrawalSchema).toBeDefined();
  });

  it("exports the api, realtime, storage and i18n entry points", () => {
    expect(core.ApiConfig).toBeDefined();
    expect(typeof core.createHttpClient).toBe("function");
    expect(core.KayaApi).toBeDefined();
    expect(core.SocketService).toBeDefined();
    expect(core.InMemoryTokenStore).toBeDefined();
    expect(typeof core.createI18n).toBe("function");
    expect(core.ApiFailure).toBeDefined();
  });

  it("exports the LocationProvider and ImageProvider contracts (type-only; a mismatch here fails to compile)", async () => {
    // LocationProvider and ImageProvider are pure interfaces -- @kaya/core
    // declares the contract but ships no runtime value for them, matching
    // the platform-free rule the lint config enforces (no expo-* import,
    // not even for a type). This exercises the barrel re-export by
    // implementing each interface inline and calling through it.
    const location: core.LocationProvider = {
      requestPermission: async () => "denied",
      getCurrent: async () => null,
      watch: () => () => {},
    };
    await expect(location.requestPermission()).resolves.toBe("denied");
    await expect(location.getCurrent()).resolves.toBeNull();
    expect(typeof location.watch(() => {}, { intervalMs: 5000, distanceFilterM: 10 })).toBe(
      "function",
    );

    const image: core.ImageProvider = {
      pickFromLibrary: async () => null,
      capture: async () => null,
      compress: async (uri: string) => ({
        uri,
        width: 100,
        height: 100,
        bytes: 1024,
      }),
    };
    await expect(image.pickFromLibrary()).resolves.toBeNull();
    await expect(image.compress("file://x.jpg")).resolves.toEqual({
      uri: "file://x.jpg",
      width: 100,
      height: 100,
      bytes: 1024,
    });
  });

  it("exports the wire coercion helpers, including isPlainObject", () => {
    expect(typeof core.isPlainObject).toBe("function");
    expect(typeof core.decimalLike).toBe("function");
    expect(typeof core.stringLike).toBe("function");
  });

  it("exports the socket room-join API and payload-error option", () => {
    const svc = new core.SocketService({ socketUrl: "http://localhost" } as InstanceType<
      typeof core.ApiConfig
    >);
    expect(typeof svc.joinOrder).toBe("function");
    expect(typeof svc.leaveOrder).toBe("function");
    expect(typeof svc.joinDelivery).toBe("function");
    expect(typeof svc.leaveDelivery).toBe("function");
  });

  it("exports the paginated response types and notification helpers", () => {
    // Type-level exports (Paginated, NotificationsPage, PaymentInit, ...) are
    // checked by the compiler at build time; this asserts the runtime values
    // that ride alongside them in api/endpoints and models/notification.
    expect(core.appNotificationSchema).toBeDefined();
    expect(typeof core.isRead).toBe("function");
  });
});
