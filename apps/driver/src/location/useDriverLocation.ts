import { useDeviceLocation, type DeviceLocation } from "@kaya/ui";
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
 * A phone on a dashboard at a red light reports a position that wanders ten
 * metres either way. Without this filter that jitter is published as movement,
 * and the client watches a marker twitching in place -- which reads as a
 * driver who is lost rather than one who is waiting.
 */
export const LOCATION_DISTANCE_M = 20;

export type { LocationPermission } from "@kaya/ui";
export type DriverLocation = DeviceLocation;

/**
 * The driver's own position: read for the nearby search, and published to the
 * gateway while they are online.
 *
 * This is the driver-side half of the client's tracking screen.
 * `location:update` carries `{ lat, lng }` and nothing else -- the gateway
 * resolves which delivery it belongs to from the socket's own identity -- so
 * the only thing this hook has to get right is *when* to publish.
 *
 * The answer is "while online", not "while on a run". Two reasons: the nearby
 * search needs a position before any delivery exists, and a driver whose
 * position stops the moment they finish a run disappears from the dispatcher's
 * view of the city. It stops at the offline flip, which matters -- a leaked
 * watch keeps the GPS and the radio awake for the rest of the day, on a
 * network where data is metered.
 *
 * `requestOnMount` follows `publishing` on purpose: a driver who was already
 * online when the app started never taps the toggle, so nothing would ever ask
 * for permission -- the position stays null, the nearby search stays disabled,
 * and the home screen shows loading skeletons for a list that cannot arrive.
 * Seen on the emulator against an account the simulated driver had left
 * online.
 */
export function useDriverLocation(publishing: boolean): DriverLocation {
  return useDeviceLocation({
    requestOnMount: publishing,
    watch: publishing,
    intervalMs: LOCATION_INTERVAL_MS,
    distanceFilterM: LOCATION_DISTANCE_M,
    onPosition: (point) => socketService.emitLocation({ lat: point.lat, lng: point.lng }),
  });
}
