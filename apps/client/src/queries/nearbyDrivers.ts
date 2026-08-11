import { queryKeys, type GeoPoint } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";

/** How wide a net the home map casts, in kilometres. */
export const NEARBY_DRIVERS_RADIUS_KM = 8;

/**
 * How often the pins refresh while the home screen is open.
 *
 * Twenty seconds: a driver moves perhaps 300 m in that time at city speed,
 * which is a pin sliding rather than teleporting, and a client leaving the
 * screen open for ten minutes costs thirty requests carrying a handful of
 * coordinates each. Faster would buy nothing a client acts on -- they are
 * reading "is anyone around", not following a specific vehicle.
 */
export const NEARBY_DRIVERS_POLL_MS = 20_000;

/**
 * Online drivers around the client, for the home map.
 *
 * A map with nothing on it says the platform is empty. The same map with four
 * moving pins says there is work being done nearby, which is the most useful
 * thing a client can know before deciding to order -- and it is the one thing
 * Bolt and Uber put on screen before anything else.
 *
 * Disabled until a position is known: "nearby" has no meaning without one, and
 * a request with a guessed centre would draw pins around a city the user is
 * not in.
 *
 * The position is rounded into the key at three decimals -- about a hundred
 * metres. A phone at rest jitters in the sixth decimal, and keying on raw
 * values would make every jitter its own cache entry and its own request; the
 * same trap `queryKeys.priceQuote` rounds away.
 */
export function useNearbyDrivers(position: GeoPoint | null): UseQueryResult<GeoPoint[]> {
  const params =
    position === null
      ? undefined
      : {
          lat: Number(position.lat.toFixed(3)),
          lng: Number(position.lng.toFixed(3)),
          radiusKm: NEARBY_DRIVERS_RADIUS_KM,
        };

  return useQuery({
    queryKey: queryKeys.nearbyDrivers(params),
    queryFn: () => api.nearbyDrivers(params ?? { lat: 0, lng: 0 }),
    enabled: params !== undefined,
    refetchInterval: params === undefined ? false : NEARBY_DRIVERS_POLL_MS,
  });
}
