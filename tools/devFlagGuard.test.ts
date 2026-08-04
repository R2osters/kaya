import { assertDevFlagsAreSafe } from "./devFlagGuard.js";

const env = (over: Record<string, string | undefined>) => over as NodeJS.ProcessEnv;

describe("assertDevFlagsAreSafe", () => {
  it("allows a build with neither flag set, whatever the backend", () => {
    expect(
      assertDevFlagsAreSafe(env({ API_BASE_URL: "https://api.kaya.example" })),
    ).toEqual({ skipAuth: false, otpDisabled: false });
  });

  it("allows both flags against a local backend", () => {
    expect(
      assertDevFlagsAreSafe(
        env({ SKIP_AUTH: "true", OTP_DISABLED: "true", API_BASE_URL: "http://localhost:3000" }),
      ),
    ).toEqual({ skipAuth: true, otpDisabled: true });
  });

  it("allows the Android emulator's loopback alias and a private-network host", () => {
    expect(
      assertDevFlagsAreSafe(env({ SKIP_AUTH: "true", API_BASE_URL: "http://10.0.2.2:3000" })).skipAuth,
    ).toBe(true);
    expect(
      assertDevFlagsAreSafe(env({ SKIP_AUTH: "true", API_BASE_URL: "http://192.168.1.24:3000" }))
        .skipAuth,
    ).toBe(true);
  });

  it("treats an unset API_BASE_URL as local, since env.ts falls back to localhost", () => {
    expect(assertDevFlagsAreSafe(env({ SKIP_AUTH: "true" })).skipAuth).toBe(true);
  });

  it("fails a production build even against a local backend", () => {
    expect(() =>
      assertDevFlagsAreSafe(
        env({ SKIP_AUTH: "true", NODE_ENV: "production", API_BASE_URL: "http://localhost:3000" }),
      ),
    ).toThrow(/must not be set for a production build/);
  });

  it("fails an EAS production profile", () => {
    expect(() =>
      assertDevFlagsAreSafe(env({ OTP_DISABLED: "true", EAS_BUILD_PROFILE: "production" })),
    ).toThrow(/must not be set for a production build/);
  });

  it("fails a debug build pointed at a real backend", () => {
    // The case the previous gate missed: NODE_ENV is not production for a
    // debug variant, so keying on build type alone let a sideloadable APK
    // ship with authentication switched off and the real API behind it.
    expect(() =>
      assertDevFlagsAreSafe(
        env({ SKIP_AUTH: "true", API_BASE_URL: "https://api.kaya.example" }),
      ),
    ).toThrow(/not a local development backend/);
  });

  it("gates OTP_DISABLED exactly as it gates SKIP_AUTH", () => {
    // Skipping the one-time code on phone auth means knowing a phone number is
    // enough to become that person — no device possession needed.
    expect(() =>
      assertDevFlagsAreSafe(
        env({ OTP_DISABLED: "true", API_BASE_URL: "https://api.kaya.example" }),
      ),
    ).toThrow(/not a local development backend/);
  });

  it("names every flag that is set in the failure message", () => {
    expect(() =>
      assertDevFlagsAreSafe(
        env({
          SKIP_AUTH: "true",
          OTP_DISABLED: "true",
          API_BASE_URL: "https://api.kaya.example",
        }),
      ),
    ).toThrow(/SKIP_AUTH and OTP_DISABLED/);
  });

  it("refuses an unparseable API_BASE_URL rather than assuming it is local", () => {
    expect(() =>
      assertDevFlagsAreSafe(env({ SKIP_AUTH: "true", API_BASE_URL: "not a url" })),
    ).toThrow(/not a local development backend/);
  });

  it("only trips on the literal string true", () => {
    expect(
      assertDevFlagsAreSafe(
        env({ SKIP_AUTH: "1", OTP_DISABLED: "yes", API_BASE_URL: "https://api.kaya.example" }),
      ),
    ).toEqual({ skipAuth: false, otpDisabled: false });
  });
});
