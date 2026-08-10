import Constants from "expo-constants";

/**
 * Runtime configuration surfaced through app.config.ts's `extra` block, which
 * app.config.ts fills in from process.env. Nothing in this module may hardcode
 * a real backend host; the only literal here is a localhost fallback.
 *
 * **`extra` is baked into the binary at build time, not read from the dev
 * server.** Verified on a device: with `SKIP_AUTH=true` passed to `expo start`
 * the dev server's manifest carried `skipAuth: true` and the app still saw
 * `false`, because `Constants.expoConfig` resolves to what the APK was built
 * with. Changing any value below means rebuilding:
 *
 *   SKIP_AUTH=true API_BASE_URL=http://10.0.2.2:3000 npm run android -w client
 *
 * The failure mode is silent, and worst for `apiBaseUrl`: an unset value falls
 * back to the localhost literal below, which on an Android emulator is the
 * emulator itself rather than the host machine, so every request fails in a
 * way that reads as "the backend is down". `10.0.2.2` is the host from inside
 * an Android emulator; a physical device needs the machine's LAN address.
 */
export interface KayaEnv {
  /** REST/socket origin, e.g. http://localhost:3000. No trailing slash. */
  apiBaseUrl: string;
  /** Google Maps key; null selects @kaya/ui's MapLibre/OSM fallback. */
  mapsApiKey: string | null;
  /**
   * Dev-only escape hatch so a screen can be opened without a backend.
   * app.config.ts refuses to build with this true in a production build --
   * see the guard there. Still defaulted to false here so a missing or
   * malformed `extra` never turns it on by accident.
   */
  skipAuth: boolean;
  /**
   * Dev/demo affordance: the OTP challenge step is skipped against the
   * sandbox Supabase backend while the Firebase Phone Auth code path is kept
   * intact (decisions log). Unlike skipAuth this does not bypass
   * authentication itself -- the user still signs in -- so it carries no
   * build-time gate.
   */
  otpDisabled: boolean;
}

const DEV_DEFAULT_API_BASE_URL = "http://localhost:3000";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(extra: Record<string, unknown>, key: string): string | null {
  const value = extra[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readBoolean(extra: Record<string, unknown>, key: string): boolean {
  return extra[key] === true;
}

/**
 * Pure resolver, exported separately from the `env` singleton so tests can
 * feed it an arbitrary `extra` shape without touching expo-constants (whose
 * expoConfig resolves to null outside a real Expo runtime, e.g. under jest).
 */
export function resolveEnv(extra: unknown): KayaEnv {
  const source = isPlainObject(extra) ? extra : {};
  return {
    apiBaseUrl: readString(source, "apiBaseUrl") ?? DEV_DEFAULT_API_BASE_URL,
    mapsApiKey: readString(source, "mapsApiKey"),
    skipAuth: readBoolean(source, "skipAuth"),
    otpDisabled: readBoolean(source, "otpDisabled"),
  };
}

export const env: KayaEnv = resolveEnv(Constants.expoConfig?.extra);
