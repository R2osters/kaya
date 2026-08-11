import type { GeoPoint } from "@kaya/core";
import { LocationAdapter } from "@kaya/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { socketService } from "../realtime/socket";

/**
 * How often the driver's position goes out on the wire while they are online.
 *
 * Five seconds is the figure the whole product is built around: the client's
 * tracking screen, the simulated driver in backend/scripts, and the
 * LocationWatchOptions doc in @kaya/core all assume it. Slower and the
 * client's marker visibly teleports; faster and a driver pays for data that
 * tells the client nothing new.
 */
export const LOCATION_INTERVAL_MS = 5_000;

/**
 * Minimum movement, in metres, before an update is worth sending.
 *
 * A phone sitting on a dashboard at a red light reports a position that wanders
 * ten metres in either direction. Without this filter that jitter is published
 * as movement, and the client watches a marker twitching in place, which reads
 * as a driver who is lost rather than one who is waiting.
 */
export const LOCATION_DISTANCE_M = 20;

export type LocationPermission = "unknown" | "granted" | "denied";

export interface DriverLocation {
  /** Last known position, or null before the first fix. */
  position: GeoPoint | null;
  permission: LocationPermission;
  /** Prompts for permission and takes one reading. Safe to call repeatedly. */
  request: () => Promise<LocationPermission>;
}

/**
 * The driver's own position: read for the nearby search, and published to the
 * gateway while they are online.
 *
 * This is the driver-side half of the client's tracking screen. `location:update`
 * carries `{ lat, lng }` and nothing else -- the gateway resolves which
 * delivery it belongs to from the socket's own identity -- so the only thing
 * this hook has to get right is *when* to publish.
 *
 * The answer is "while online", not "while on a run". Two reasons: the nearby
 * search needs a position before any delivery exists, and a driver whose
 * position stops the moment they finish a run disappears from the dispatcher's
 * view of the city. The stream stops when they go offline, which is the point
 * at which they have said they are done -- and stopping it matters: a leaked
 * watch keeps the GPS and the radio awake for the rest of the day, on a
 * network where data is metered.
 *
 * Permission refusal is a state, not an error. The home screen renders it and
 * offers to ask again; it does not treat it as a failure to go online, because
 * a driver without GPS can still legitimately want to be marked available.
 */
export function useDriverLocation(publishing: boolean): DriverLocation {
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [permission, setPermission] = useState<LocationPermission>("unknown");
  // One adapter for the life of the hook. Rebuilding it per render would be
  // harmless today but would make the watch effect below depend on identity
  // rather than on `publishing`, and restart the GPS on every render.
  const adapter = useRef(new LocationAdapter()).current;

  const request = useCallback(async (): Promise<LocationPermission> => {
    const status = await adapter.requestPermission();
    setPermission(status);
    if (status === "granted") {
      setPosition(await adapter.getCurrent());
    }
    return status;
  }, [adapter]);

  // A driver who was already online when the app started never taps the
  // toggle, so nothing would ever ask for permission: the position stays
  // null, the nearby search stays disabled, and the home screen shows loading
  // skeletons for a list that will never arrive. Seen on the emulator the
  // first time the app opened against an account the simulated driver had
  // left online.
  useEffect(() => {
    if (publishing && permission === "unknown") {
      void request();
    }
  }, [publishing, permission, request]);

  useEffect(() => {
    if (!publishing || permission !== "granted") return;

    const stop = adapter.watch(
      (point) => {
        setPosition(point);
        socketService.emitLocation({ lat: point.lat, lng: point.lng });
      },
      {
        intervalMs: LOCATION_INTERVAL_MS,
        distanceFilterM: LOCATION_DISTANCE_M,
        // The stream is dead once this fires. Reflected as a lost permission
        // so the screen shows the same "location unavailable" affordance it
        // shows for a refusal, rather than pretending positions still flow.
        onError: () => setPermission("denied"),
      },
    );
    return stop;
  }, [adapter, publishing, permission]);

  return { position, permission, request };
}
