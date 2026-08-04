import Constants from "expo-constants";

/**
 * Runtime configuration surfaced through app.config.ts's `extra` block,
 * which app.config.ts fills in from process.env at build/start time -- see
 * that file for the SKIP_AUTH production guard. Nothing in this module may
 * hardcode a real backend host; the only literal here is a localhost
 * fallback for a developer running the backend alongside Metro.
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
