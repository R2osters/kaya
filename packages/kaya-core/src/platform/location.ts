import type { GeoPoint } from "../models/geo";

/**
 * Controls for a position subscription. The driver app re-publishes its
 * position every 5 seconds while on a run, so both the polling interval and
 * the minimum-movement threshold are caller-controlled rather than left to a
 * platform default that a screen cannot reason about.
 */
export interface LocationWatchOptions {
  /** Minimum time between updates, in milliseconds. */
  intervalMs: number;
  /**
   * Minimum movement, in meters, an update must represent to fire even after
   * intervalMs has elapsed. Filters out GPS jitter while stationary.
   */
  distanceFilterM: number;
}

/**
 * Platform boundary for device location. Screens — and the driver run-tracking
 * flow in particular — depend on this interface, never on expo-location
 * directly, so a test double or a future platform swap does not have to reach
 * into every screen that reads or watches position. The concrete
 * implementation on expo-location lives in @kaya/ui: see
 * packages/kaya-ui/src/adapters/LocationAdapter.ts.
 *
 * Permission handling: a refusal is an ordinary, recoverable outcome on a
 * delivery app — the user can grant it later from device Settings — not an
 * exceptional one. requestPermission() reports a refusal as a value
 * ("denied"), never a rejection, and getCurrent() resolves null — it never
 * throws — when permission is missing or a position cannot be read. This is
 * the same "recoverable absence resolves, only an unexpected failure throws"
 * convention @kaya/core's TokenStore already uses for its reads (see
 * storage/tokenStore.ts). A caller that needs to distinguish "denied" from
 * "granted but no fix yet" calls requestPermission() (or a getPermission
 * equivalent on the adapter) explicitly rather than inferring it from a null
 * getCurrent() result.
 *
 * getCurrent() and watch() both act on whatever permission state already
 * exists — they do not themselves trigger the OS permission prompt. Only
 * requestPermission() does that. A screen that has not asked yet should call
 * requestPermission() before relying on either.
 */
export interface LocationProvider {
  /** Requests foreground location permission. Never rejects for a refusal. */
  requestPermission(): Promise<"granted" | "denied">;

  /**
   * Reads the current position once. Resolves null — never rejects — when
   * permission is not granted or a position could not be obtained (GPS off,
   * no fix yet, a transient platform error).
   */
  getCurrent(): Promise<GeoPoint | null>;

  /**
   * Subscribes to position updates at the given interval/distance filter and
   * returns an unsubscribe function.
   *
   * The returned function is always safe to call, including more than once,
   * and is what actually stops delivery of further updates — a leaked
   * subscription outlives the run and keeps the GPS and radio active on a
   * phone for the rest of the day, on a network where data costs money. If
   * permission is not currently granted, watch() never invokes `callback`;
   * it does not itself prompt for permission.
   */
  watch(callback: (point: GeoPoint) => void, options: LocationWatchOptions): () => void;
}
