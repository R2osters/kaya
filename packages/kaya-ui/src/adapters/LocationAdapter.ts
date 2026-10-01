import type { GeoPoint, LocationProvider, LocationWatchOptions } from "@kaya/core";
import * as Location from "expo-location";

/**
 * How long a first fix is worth waiting for before falling back to the last
 * known position. Long enough for a warm GPS outdoors, short enough that a
 * screen waiting on it does not look frozen.
 */
const FIX_TIMEOUT_MS = 6_000;

/** Resolves the promise's value, or null once `ms` have passed. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    // The loser keeps running -- there is no cancelling a native read -- but
    // its timer must not hold the JS runtime awake for six seconds after
    // every call.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Platform-backed LocationProvider on expo-location. This is the concrete
 * half of the LocationProvider interface @kaya/core declares — see
 * packages/kaya-core/src/platform/location.ts.
 */
export class LocationAdapter implements LocationProvider {
  async requestPermission(): Promise<"granted" | "denied"> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  }

  async getCurrent(): Promise<GeoPoint | null> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }
    try {
      // Bounded, and last-known as the fallback. `getCurrentPositionAsync`
      // does not fail when there is no satellite fix -- it waits, and it can
      // wait forever: inside a covered market, in a stairwell, or on an
      // emulator with no injected location. A caller awaiting it has no
      // failure to render and no result either, so the screen sits on its
      // loading state indefinitely (seen on the emulator, where the driver's
      // nearby list showed skeletons that could never resolve).
      //
      // A position from a minute ago is worth far more here than a perfect
      // one that never arrives: everything reading this -- a nearby search, a
      // map's initial centre -- is answering "roughly where am I", and the
      // watch that follows corrects it within seconds.
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        FIX_TIMEOUT_MS,
      );
      if (position !== null) {
        return { lat: position.coords.latitude, lng: position.coords.longitude };
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      return lastKnown === null
        ? null
        : { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
    } catch {
      // A recoverable read failure (GPS off, no fix yet, a transient
      // platform error) degrades to null for the same reason
      // SecureTokenStore's reads do -- see adapters/SecureTokenStore.ts. A
      // throw here would propagate straight into a screen and turn "no fix
      // yet" into a crash.
      return null;
    }
  }

  watch(callback: (point: GeoPoint) => void, options: LocationWatchOptions): () => void {
    let stopped = false;
    let subscription: Location.LocationSubscription | null = null;

    // watchPositionAsync is itself async, but the LocationProvider contract
    // requires watch() to return its unsubscribe synchronously (the caller
    // may need it immediately, e.g. to clean up on unmount before the
    // subscription has even been established). `stopped` covers the race
    // where the caller unsubscribes before this resolves: the subscription
    // is removed the moment it exists instead of being left to run.
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted" || stopped) {
        return;
      }
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: options.intervalMs,
          distanceInterval: options.distanceFilterM,
        },
        (position) => {
          callback({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
      );
      if (stopped) {
        sub.remove();
        return;
      }
      subscription = sub;
    })().catch((error: unknown) => {
      // GPS switched off mid-run, or a transient platform error. Left
      // unhandled this is an unhandled promise rejection — a console warning
      // in some React Native configurations and a fatal in others, over
      // something the contract calls recoverable everywhere else.
      //
      // It is reported rather than merely swallowed: the position stream is
      // now dead, and a driver whose client sees a frozen marker deserves
      // better than silence. Same shape as SocketService's onPayloadError.
      options.onError?.(error);
    });

    return () => {
      stopped = true;
      subscription?.remove();
      subscription = null;
    };
  }
}
