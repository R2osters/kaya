import { resolveEnv } from "./env";

describe("resolveEnv", () => {
  it("falls back to a local dev API host when app.config.ts supplied nothing", () => {
    const env = resolveEnv({});

    expect(env.apiBaseUrl).toBe("http://localhost:3000");
  });

  it("uses the API base URL app.config.ts put in extra, verbatim", () => {
    const env = resolveEnv({ apiBaseUrl: "https://staging.kaya.example" });

    expect(env.apiBaseUrl).toBe("https://staging.kaya.example");
  });

  it("defaults mapsApiKey to null, selecting @kaya/ui's MapLibre fallback", () => {
    const env = resolveEnv({});

    expect(env.mapsApiKey).toBeNull();
  });

  it("passes a configured maps key through", () => {
    const env = resolveEnv({ mapsApiKey: "AIza-test-key" });

    expect(env.mapsApiKey).toBe("AIza-test-key");
  });

  it("treats an empty string the same as an absent key, for both string fields", () => {
    const env = resolveEnv({ apiBaseUrl: "", mapsApiKey: "" });

    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.mapsApiKey).toBeNull();
  });

  it("defaults skipAuth and otpDisabled to false", () => {
    const env = resolveEnv({});

    expect(env.skipAuth).toBe(false);
    expect(env.otpDisabled).toBe(false);
  });

  it("only turns skipAuth on for a literal boolean true, not a truthy string", () => {
    expect(resolveEnv({ skipAuth: "true" }).skipAuth).toBe(false);
    expect(resolveEnv({ skipAuth: true }).skipAuth).toBe(true);
  });

  it("reads otpDisabled the same way", () => {
    expect(resolveEnv({ otpDisabled: "true" }).otpDisabled).toBe(false);
    expect(resolveEnv({ otpDisabled: true }).otpDisabled).toBe(true);
  });

  it("never throws on a malformed extra shape (array, string, null)", () => {
    expect(() => resolveEnv(null)).not.toThrow();
    expect(() => resolveEnv([1, 2, 3])).not.toThrow();
    expect(() => resolveEnv("not an object")).not.toThrow();
  });
});

describe("env (the live singleton)", () => {
  it("reads through expo-constants and still resolves to the dev default under jest, where no manifest is embedded", () => {
    // Isolated require: expo-constants' expoConfig getter resolves to null
    // outside a real Expo runtime (no embedded manifest, no dev-launcher, no
    // Updates manifest), which is exactly the "nothing configured" case
    // resolveEnv must degrade gracefully from.
    jest.resetModules();
    const { env } = require("./env") as typeof import("./env");

    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.skipAuth).toBe(false);
    expect(env.otpDisabled).toBe(false);
  });
});
