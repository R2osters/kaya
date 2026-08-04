import type { GeoPoint, LocationProvider, LocationWatchOptions } from "@kaya/core";
import * as Location from "expo-location";

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
      const position = await Location.getCurrentPositionAsync({});
      return { lat: position.coords.latitude, lng: position.coords.longitude };
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
    })();

    return () => {
      stopped = true;
      subscription?.remove();
      subscription = null;
    };
  }
}
