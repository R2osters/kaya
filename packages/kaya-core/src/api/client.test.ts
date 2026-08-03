import MockAdapter from "axios-mock-adapter";
import { ApiConfig } from "./config";
import { createHttpClient } from "./client";
import type { TokenStore } from "../storage/tokenStore";

class FakeStore implements TokenStore {
  access: string | null = "old-access";
  refresh: string | null = "refresh-1";
  cleared = false;
  saves = 0;

  async readAccess() {
    return this.access;
  }
  async readRefresh() {
    return this.refresh;
  }
  async save(t: { accessToken: string; refreshToken: string }) {
    this.saves += 1;
    this.access = t.accessToken;
    this.refresh = t.refreshToken;
  }
  async clear() {
    this.cleared = true;
    this.access = null;
    this.refresh = null;
  }
}

const config = new ApiConfig({ baseUrl: "http://localhost:3000" });

describe("ApiConfig", () => {
  it("appends the version prefix for REST and leaves the origin for sockets", () => {
    expect(config.restBaseUrl).toBe("http://localhost:3000/api/v1");
    expect(config.socketUrl).toBe("http://localhost:3000");
  });

  it("trims a trailing slash", () => {
    const c = new ApiConfig({ baseUrl: "http://localhost:3000/" });
    expect(c.restBaseUrl).toBe("http://localhost:3000/api/v1");
  });
});

describe("auth interceptor", () => {
  it("attaches the bearer token", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let seen: string | undefined;
    mock.onGet("/auth/me").reply((cfg) => {
      seen = cfg.headers?.Authorization as string | undefined;
      return [200, { id: "u1" }];
    });

    await client.get("/auth/me");
    expect(seen).toBe("Bearer old-access");
  });

  it("omits the bearer token when skipAuth is set", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let seen: string | undefined;
    mock.onPost("/auth/login").reply((cfg) => {
      seen = cfg.headers?.Authorization as string | undefined;
      return [200, {}];
    });

    await client.post("/auth/login", {}, { skipAuth: true } as never);
    expect(seen).toBeUndefined();
  });

  it("refreshes on 401 and replays the request once", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let attempts = 0;
    mock.onGet("/orders").reply(() => {
      attempts += 1;
      return attempts === 1 ? [401, {}] : [200, [{ id: "o1" }]];
    });
    mock.onPost("/auth/refresh").reply(200, {
      accessToken: "new-access",
      refreshToken: "refresh-2",
    });

    const res = await client.get("/orders");
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
    expect(store.access).toBe("new-access");
  });

  it("coalesces concurrent refreshes into a single call", async () => {
    // Two parallel 401s must not rotate the refresh token twice — the second
    // rotation would revoke the first and log the user out at random.
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    const seen: { a: number; b: number } = { a: 0, b: 0 };
    mock.onGet("/orders").reply(() => {
      seen.a += 1;
      return seen.a === 1 ? [401, {}] : [200, []];
    });
    mock.onGet("/notifications").reply(() => {
      seen.b += 1;
      return seen.b === 1 ? [401, {}] : [200, []];
    });

    let refreshCalls = 0;
    mock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, { accessToken: "new-access", refreshToken: "refresh-2" }];
    });

    await Promise.all([client.get("/orders"), client.get("/notifications")]);
    expect(refreshCalls).toBe(1);
    expect(store.saves).toBe(1);
  });

  it("clears the session when the refresh itself fails", async () => {
    const store = new FakeStore();
    let expired = 0;
    const client = createHttpClient({
      config,
      store,
      onSessionExpired: () => {
        expired += 1;
      },
    });
    const mock = new MockAdapter(client);

    mock.onGet("/orders").reply(401, {});
    mock.onPost("/auth/refresh").reply(401, {});

    await expect(client.get("/orders")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(store.cleared).toBe(true);
    expect(expired).toBe(1);
  });

  it("does not refresh when there is no refresh token", async () => {
    const store = new FakeStore();
    store.refresh = null;
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let refreshCalls = 0;
    mock.onGet("/orders").reply(401, {});
    mock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, {}];
    });

    await expect(client.get("/orders")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(refreshCalls).toBe(0);
  });

  it("rejects with an ApiFailure, not a raw axios error", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);
    mock.onGet("/orders").reply(409, { message: "Offer already accepted" });

    await expect(client.get("/orders")).rejects.toMatchObject({
      kind: "conflict",
      message: "Offer already accepted",
    });
  });
});
