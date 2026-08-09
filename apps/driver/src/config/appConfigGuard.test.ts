/**
 * Tests app.config.ts's build-time production guard for SKIP_AUTH.
 *
 * This lives under src/config rather than next to app.config.ts at the repo
 * root because jest.config.js's `roots` only scans `app/` and `src/` -- see
 * the comment there. app.config.ts itself stays at the app root, which is
 * where Expo/EAS tooling requires it.
 *
 * SKIP_AUTH exists so a screen can be opened without a backend during
 * development. A runtime `if` inside a screen cannot gate it, because the
 * flag's whole purpose is to change behaviour before any screen renders --
 * so the gate has to live in app.config.ts, which every build tool (expo
 * start, expo prebuild, expo export, eas build) evaluates before anything
 * else runs. Throwing there fails the build outright instead of shipping a
 * binary that silently honours the flag.
 */

const ORIGINAL_ENV = process.env;

// @types/node marks NODE_ENV read-only on ProcessEnv; this test intentionally
// mutates it (and other vars) per-case to exercise app.config.ts's guard, so
// every write goes through this cast rather than fighting the type. Reads
// `process.env` fresh each call rather than caching a reference to it, since
// beforeEach below reassigns `process.env` to a new object per test.
function setEnv(key: string, value: string): void {
  (process.env as Record<string, string | undefined>)[key] = value;
}

function unsetEnv(key: string): void {
  delete (process.env as Record<string, string | undefined>)[key];
}

function loadConfig(): { extra?: Record<string, unknown> } {
  // Deliberate fresh require per test, after jest.resetModules(), so the
  // module-level guard in app.config.ts re-evaluates against this test's
  // process.env -- see the .eslintrc.cjs override for src/**/*.test.ts.
  return (require("../../app.config") as { default: { extra?: Record<string, unknown> } })
    .default;
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("app.config.ts -- SKIP_AUTH production guard", () => {
  it("fails the build when SKIP_AUTH is set and NODE_ENV is production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("SKIP_AUTH", "true");

    expect(() => loadConfig()).toThrow(/SKIP_AUTH/);
  });

  it("fails the build when SKIP_AUTH is set and EAS built through the production profile", () => {
    setEnv("NODE_ENV", "test");
    setEnv("EAS_BUILD_PROFILE", "production");
    setEnv("SKIP_AUTH", "true");

    expect(() => loadConfig()).toThrow(/SKIP_AUTH/);
  });

  it("does not fail a production build when SKIP_AUTH is unset", () => {
    setEnv("NODE_ENV", "production");
    unsetEnv("SKIP_AUTH");

    expect(() => loadConfig()).not.toThrow();
  });

  it("does not fail a non-production EAS profile (development/preview) just for being an EAS build", () => {
    setEnv("NODE_ENV", "test");
    setEnv("EAS_BUILD_PROFILE", "development");
    setEnv("SKIP_AUTH", "true");

    expect(() => loadConfig()).not.toThrow();
  });

  it("allows SKIP_AUTH outside of a production build", () => {
    setEnv("NODE_ENV", "development");
    setEnv("SKIP_AUTH", "true");

    expect(loadConfig().extra?.skipAuth).toBe(true);
  });

  it("defaults extra.skipAuth to false when the env var is unset", () => {
    setEnv("NODE_ENV", "development");
    unsetEnv("SKIP_AUTH");

    expect(loadConfig().extra?.skipAuth).toBe(false);
  });

  it("only a literal \"true\" turns SKIP_AUTH on, not any other truthy string", () => {
    setEnv("NODE_ENV", "development");
    setEnv("SKIP_AUTH", "1");

    expect(loadConfig().extra?.skipAuth).toBe(false);
  });

  it("passes API_BASE_URL, MAPS_API_KEY and OTP_DISABLED through to extra", () => {
    setEnv("NODE_ENV", "development");
    setEnv("API_BASE_URL", "http://10.0.2.2:3000");
    setEnv("MAPS_API_KEY", "test-key");
    setEnv("OTP_DISABLED", "true");
    unsetEnv("SKIP_AUTH");

    const extra = loadConfig().extra;
    expect(extra?.apiBaseUrl).toBe("http://10.0.2.2:3000");
    expect(extra?.mapsApiKey).toBe("test-key");
    expect(extra?.otpDisabled).toBe(true);
  });

  it("leaves apiBaseUrl/mapsApiKey null in extra when unset, rather than baking in a host", () => {
    setEnv("NODE_ENV", "development");
    unsetEnv("API_BASE_URL");
    unsetEnv("MAPS_API_KEY");
    unsetEnv("SKIP_AUTH");

    const extra = loadConfig().extra;
    expect(extra?.apiBaseUrl).toBeNull();
    expect(extra?.mapsApiKey).toBeNull();
  });
});
