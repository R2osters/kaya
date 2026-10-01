import { queryKeys, type GeoPoint, type NearbyOrder } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";

/** How wide a net the home screen casts, in kilometres. */
export const NEARBY_RADIUS_KM = 10;

/**
 * How often the nearby list refetches while the driver is online.
 *
 * Polling, not a socket event, because the gateway has no driver-facing
 * new-order channel: `orders.service.ts` emits `order:new` into the *client's*
 * room only. Nearby polling plus an FCM push are the v1 mechanisms, and that
 * was a decision, not an oversight (see the BLUEPRINT entry of 2026-07-11).
 *
 * 15 seconds is a compromise against mobile data in the region: a driver
 * sitting online for an eight-hour shift makes ~1900 requests at this rate,
 * and a request whose body is a handful of orders is a few kilobytes. Faster
 * polling buys seconds on a bid that stays open for minutes.
 */
export const NEARBY_POLL_MS = 15_000;

/**
 * Published orders within reach (`GET /orders/nearby`).
 *
 * Disabled until the driver is both online and located. Offline, the backend
 * would answer with work they cannot bid on; without a position there is no
 * "nearby" to speak of, and the endpoint's lat/lng are what make
 * `distanceToPickupKm` mean anything.
 *
 * The position is rounded into the key at three decimals -- about a hundred
 * metres. A parked driver's GPS jitters in the sixth decimal, and keying on
 * raw values would make every jitter a distinct cache entry and a distinct
 * request, which is the same trap `queryKeys.priceQuote` rounds away.
 */
export function useNearbyOrders(
  position: GeoPoint | null,
  online: boolean,
): UseQueryResult<NearbyOrder[]> {
  const enabled = online && position !== null;
  const params =
    position === null
      ? undefined
      : {
          lat: Number(position.lat.toFixed(3)),
          lng: Number(position.lng.toFixed(3)),
          radiusKm: NEARBY_RADIUS_KM,
        };

  return useQuery({
    queryKey: queryKeys.nearbyOrders(params),
    queryFn: () => api.nearbyOrders(params ?? {}),
    enabled,
    refetchInterval: enabled ? NEARBY_POLL_MS : false,
  });
}
