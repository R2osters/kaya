import type { GeoPoint, LocationProvider } from "@kaya/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocationAdapter } from "../adapters/LocationAdapter";

export type LocationPermission = "unknown" | "granted" | "denied";

export interface DeviceLocation {
  /** Last known position, or null before the first read. */
  position: GeoPoint | null;
  permission: LocationPermission;
  /** Prompts for permission and takes one reading. Safe to call repeatedly. */
  request: () => Promise<LocationPermission>;
}

export interface DeviceLocationOptions {
  /**
   * Ask for permission as soon as the hook mounts.
   *
   * Off by default, and that default is the point: a permission prompt on
   * first open, before the app has shown what it needs location for, is the
   * one most often refused outright -- and on Android a refusal is close to
   * permanent. Screens turn it on only once the user has done something that
   * obviously needs a position (a driver going online, a client opening the
   * address picker).
   */
  requestOnMount?: boolean;
  /**
   * Keep following the position after the first fix. Off by default: a watch
   * holds the GPS and the radio awake, which on a metered West African
   * connection and a shared phone battery is not something to switch on for a
   * screen that only needs to know roughly where you are.
   */
  watch?: boolean;
  /** Milliseconds between watched updates. Ignored unless `watch`. */
  intervalMs?: number;
  /** Metres of movement before a watched update fires. Ignored unless `watch`. */
  distanceFilterM?: number;
  /** Injected in tests; defaults to the expo-location adapter. */
  provider?: LocationProvider;
  /** Called on every watched position, before state is updated. */
  onPosition?: (point: GeoPoint) => void;
}

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_DISTANCE_M = 20;

/**
 * The device's own position, with the permission dance done once.
 *
 * Both apps need this and for different reasons -- the driver publishes their
 * position to the gateway while online, the client centres its map and
 * pre-fills a pickup address -- but the awkward part is identical: ask, handle
 * a refusal as a state rather than an error, read a first fix, and tear the
 * watch down on unmount so it does not outlive the screen.
 *
 * A refusal is a state, not a failure. Screens render it and offer to ask
 * again; nothing here throws, because a delivery app has to keep working for
 * someone who has said no to location and is typing their address by hand.
 */
export function useDeviceLocation(options: DeviceLocationOptions = {}): DeviceLocation {
  const {
    requestOnMount = false,
    watch = false,
    intervalMs = DEFAULT_INTERVAL_MS,
    distanceFilterM = DEFAULT_DISTANCE_M,
    provider,
    onPosition,
  } = options;

  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [permission, setPermission] = useState<LocationPermission>("unknown");

  // One provider for the life of the hook. Rebuilding it per render would make
  // the watch effect below depend on identity rather than on its options, and
  // restart the GPS on every render.
  const adapterRef = useRef<LocationProvider | null>(null);
  adapterRef.current ??= provider ?? new LocationAdapter();
  const adapter = adapterRef.current;

  // Held in a ref so a caller passing an inline arrow does not restart the
  // watch on every render.
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const request = useCallback(async (): Promise<LocationPermission> => {
    const status = await adapter.requestPermission();
    setPermission(status);
    if (status === "granted") {
      setPosition(await adapter.getCurrent());
    }
    return status;
  }, [adapter]);

  useEffect(() => {
    if (requestOnMount && permission === "unknown") {
      void request();
    }
  }, [requestOnMount, permission, request]);

  useEffect(() => {
    if (!watch || permission !== "granted") return;

    return adapter.watch(
      (point) => {
        onPositionRef.current?.(point);
        setPosition(point);
      },
      {
        intervalMs,
        distanceFilterM,
        // The stream is dead once this fires. Reflected as a lost permission
        // so the screen shows the same "location unavailable" affordance it
        // shows for a refusal, rather than pretending positions still flow.
        onError: () => setPermission("denied"),
      },
    );
  }, [adapter, watch, permission, intervalMs, distanceFilterM]);

  return { position, permission, request };
}
