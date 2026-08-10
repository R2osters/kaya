import { queryKeys, type GeoPoint, type PriceQuote } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * The minimum price for a delivery between two points
 * (`GET /calculate-price`).
 *
 * Disabled until both points are set, so an order half-filled in issues no
 * request. The key carries both points, which means moving one pin refetches
 * and moving it back is served from the cache -- a user comparing two possible
 * pickup spots does not pay for the same quote twice.
 *
 * `staleTime` is short. The quote depends on `country_configs` (price per km,
 * base fee) and on the distance provider, and an admin changing a tariff
 * should reach a screen someone is still looking at within a minute rather
 * than at the next cold start.
 */
export function usePriceQuote(
  pickup: GeoPoint | null,
  dropoff: GeoPoint | null,
): UseQueryResult<PriceQuote> {
  const ready = pickup !== null && dropoff !== null;

  return useQuery({
    queryKey: queryKeys.priceQuote(pickup, dropoff),
    queryFn: () =>
      api.calculatePrice({
        pickupLat: pickup!.lat,
        pickupLng: pickup!.lng,
        deliveryLat: dropoff!.lat,
        deliveryLng: dropoff!.lng,
      }),
    enabled: ready,
    staleTime: 60 * 1000,
  });
}
