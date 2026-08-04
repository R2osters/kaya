import type { GeoPoint } from "../models/geo";
import type { LocationProvider, LocationWatchOptions } from "./location";

/**
 * A minimal, non-platform implementation used only to verify the shape of
 * LocationProvider — that a conforming implementation can satisfy the
 * contract with plain data, and that watch()'s unsubscribe genuinely stops
 * delivery. The real expo-location-backed adapter lives in @kaya/ui and is
 * tested there; this file has no platform dependency, matching @kaya/core's
 * "declare the interface, no runtime import" rule.
 */
class FakeLocationProvider implements LocationProvider {
  permission: "granted" | "denied" = "granted";
  /** Records what watch() was last called with, so tests can assert on it. */
  lastWatchOptions: LocationWatchOptions | null = null;
  private current: GeoPoint | null = { lat: 5.6, lng: -0.19 };
  private listeners = new Set<(point: GeoPoint) => void>();

  async requestPermission(): Promise<"granted" | "denied"> {
    return this.permission;
  }

  async getCurrent(): Promise<GeoPoint | null> {
    if (this.permission !== "granted") {
      return null;
    }
    return this.current;
  }

  watch(callback: (point: GeoPoint) => void, options: LocationWatchOptions): () => void {
    this.lastWatchOptions = options;
    if (this.permission !== "granted") {
      return () => {};
    }
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Test helper: simulates the platform emitting a new fix. */
  emit(point: GeoPoint): void {
    for (const listener of this.listeners) {
      listener(point);
    }
  }
}

describe("LocationProvider contract", () => {
  it("requestPermission resolves the literal union, never rejects", async () => {
    const provider = new FakeLocationProvider();
    await expect(provider.requestPermission()).resolves.toBe("granted");
  });

  it("getCurrent resolves null (not a rejection) once permission is denied", async () => {
    const provider = new FakeLocationProvider();
    provider.permission = "denied";

    await expect(provider.getCurrent()).resolves.toBeNull();
  });

  it("getCurrent resolves a GeoPoint when permission is granted", async () => {
    const provider = new FakeLocationProvider();

    await expect(provider.getCurrent()).resolves.toEqual({ lat: 5.6, lng: -0.19 });
  });

  it("watch takes an interval and a distance filter, and delivers updates to the callback", () => {
    const provider = new FakeLocationProvider();
    const received: GeoPoint[] = [];
    const options: LocationWatchOptions = { intervalMs: 5000, distanceFilterM: 10 };

    const unsubscribe = provider.watch((point) => received.push(point), options);

    expect(provider.lastWatchOptions).toEqual({ intervalMs: 5000, distanceFilterM: 10 });
    provider.emit({ lat: 5.601, lng: -0.191 });
    expect(received).toEqual([{ lat: 5.601, lng: -0.191 }]);

    unsubscribe();
  });

  it("watch's returned unsubscribe genuinely stops delivery", () => {
    const provider = new FakeLocationProvider();
    const received: GeoPoint[] = [];

    const unsubscribe = provider.watch((point) => received.push(point), {
      intervalMs: 5000,
      distanceFilterM: 10,
    });
    unsubscribe();
    provider.emit({ lat: 5.602, lng: -0.192 });

    expect(received).toEqual([]);
  });

  it("unsubscribe is safe to call more than once", () => {
    const provider = new FakeLocationProvider();
    const unsubscribe = provider.watch(
      () => {},
      { intervalMs: 5000, distanceFilterM: 10 },
    );

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });
});
