import { InMemoryTokenStore } from "./tokenStore";

describe("InMemoryTokenStore", () => {
  it("starts empty", async () => {
    const store = new InMemoryTokenStore();
    expect(await store.readAccess()).toBeNull();
    expect(await store.readRefresh()).toBeNull();
  });

  it("round-trips a token pair", async () => {
    const store = new InMemoryTokenStore();
    await store.save({ accessToken: "a", refreshToken: "r" });
    expect(await store.readAccess()).toBe("a");
    expect(await store.readRefresh()).toBe("r");
  });

  it("clears both tokens", async () => {
    const store = new InMemoryTokenStore();
    await store.save({ accessToken: "a", refreshToken: "r" });
    await store.clear();
    expect(await store.readAccess()).toBeNull();
    expect(await store.readRefresh()).toBeNull();
  });
});
