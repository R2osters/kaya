import type { AxiosInstance } from "axios";

// Fixed values so assertions don't depend on expo-constants' real (empty,
// under jest) manifest resolution -- env.ts itself is covered separately in
// src/config/env.test.ts.
jest.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "https://example.test",
    mapsApiKey: null,
    skipAuth: false,
    otpDisabled: false,
  },
}));

// Every binding referenced from inside a jest.mock() factory below must be
// prefixed "mock" (case-insensitive) -- babel-plugin-jest-hoist only allows
// that pattern (plus a short built-in allowlist) through its hoisting scope
// check, since jest.mock() calls are hoisted above these declarations.
const mockHttpClient = { isMockHttpClient: true } as unknown as AxiosInstance;
let mockCapturedOnSessionExpired: (() => void | Promise<void>) | undefined;
let mockCapturedStore: unknown;

jest.mock("@kaya/core", () => {
  const actual = jest.requireActual("@kaya/core");
  return {
    ...actual,
    createHttpClient: jest.fn(
      (opts: { store: unknown; onSessionExpired: () => void | Promise<void> }) => {
        mockCapturedStore = opts.store;
        mockCapturedOnSessionExpired = opts.onSessionExpired;
        return mockHttpClient;
      },
    ),
  };
});

// @kaya/ui pulls in the whole component tree; this module only needs
// SecureTokenStore, so it is mocked wholesale rather than requiring the real
// package (already covered by packages/kaya-ui/src/adapters/SecureTokenStore.test.ts).
class MockSecureTokenStore {
  readAccess = jest.fn();
  readRefresh = jest.fn();
  save = jest.fn();
  clear = jest.fn();
}
jest.mock("@kaya/ui", () => ({
  SecureTokenStore: MockSecureTokenStore,
}));

// require(), not a dynamic import(): this test's Babel/Jest setup does not
// support dynamic import() outside --experimental-vm-modules, and require()
// gives module-cache semantics equivalent to what a static import would
// (single evaluation, same object on every call) -- which is exactly the
// "singleton per app" behaviour under test.
function loadClientModule(): typeof import("./client") {
  return require("./client") as typeof import("./client");
}

describe("api/client singletons", () => {
  beforeEach(() => {
    // client.ts only runs its module-level setup (and so only calls the
    // mocked createHttpClient) once per module instance. Resetting the
    // module registry per test, not just the mocks, is what makes every
    // test's fresh loadClientModule() call re-populate mockCapturedStore /
    // mockCapturedOnSessionExpired -- without it, only the first test in
    // the file would ever see them set.
    jest.resetModules();
    jest.clearAllMocks();
    mockCapturedOnSessionExpired = undefined;
    mockCapturedStore = undefined;
  });

  it("builds an ApiConfig from env.apiBaseUrl", () => {
    const { apiConfig } = loadClientModule();
    expect(apiConfig.baseUrl).toBe("https://example.test");
    expect(apiConfig.restBaseUrl).toBe("https://example.test/api/v1");
  });

  it("wires createHttpClient to a SecureTokenStore, not any other TokenStore", () => {
    loadClientModule();
    expect(mockCapturedStore).toBeInstanceOf(MockSecureTokenStore);
  });

  it("exposes the axios instance createHttpClient produced", () => {
    const { httpClient } = loadClientModule();
    expect(httpClient).toBe(mockHttpClient);
  });

  it("exposes a KayaApi built on that http client", () => {
    const { api } = loadClientModule();
    const { KayaApi } = jest.requireActual("@kaya/core");
    expect(api).toBeInstanceOf(KayaApi);
  });

  it("re-importing the module returns the same singleton instances", () => {
    const first = loadClientModule();
    const second = loadClientModule();
    expect(second.apiConfig).toBe(first.apiConfig);
    expect(second.httpClient).toBe(first.httpClient);
    expect(second.api).toBe(first.api);
  });

  it("defaults onSessionExpired to a warning until Task 3's auth store wires a handler", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    loadClientModule();

    await mockCapturedOnSessionExpired?.();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("setOnSessionExpired replaces the handler createHttpClient calls on a dead refresh", async () => {
    const { setOnSessionExpired } = loadClientModule();
    const handler = jest.fn();

    setOnSessionExpired(handler);
    await mockCapturedOnSessionExpired?.();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
