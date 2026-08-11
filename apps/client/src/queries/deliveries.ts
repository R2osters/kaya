import {
  queryKeys,
  type Delivery,
  type DeliveryStatusEvent,
  type DriverLocationEvent,
} from "@kaya/core";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../api/client";
import { socketService } from "../realtime/socket";

/**
 * One delivery, with the delivery room joined for as long as the caller is
 * mounted.
 *
 * The join is what unlocks `location:driver`, `delivery:status` and
 * `chat:message` for this delivery -- the gateway's `chat:join` handler is the
 * only way in, and the realtime bridge joins nothing by design. Without it the
 * screen renders a map that never moves and a timeline that never advances,
 * with no error to explain why.
 */
export function useDelivery(deliveryId: string): UseQueryResult<Delivery> {
  useEffect(() => {
    socketService.joinDelivery(deliveryId);
    return () => socketService.leaveDelivery(deliveryId);
  }, [deliveryId]);

  return useQuery({
    queryKey: queryKeys.delivery(deliveryId),
    queryFn: () => api.getDelivery(deliveryId),
    enabled: deliveryId !== "",
  });
}

/**
 * The driver's last known position, as written by the realtime bridge.
 *
 * There is no `queryFn`: this entry is never fetched, only written to by
 * `applyRealtimeEvent`. Positions arrive every ~5s while a driver is on a run,
 * and a refetch per tick is unaffordable on West African mobile data -- the
 * event carries the whole position, so it is a pure cache write.
 *
 * Keyed by driver rather than by delivery because the `location:driver`
 * payload carries `livreur_id` and no delivery id at all: the gateway resolves
 * the target delivery server-side. A tracking screen knows its delivery's
 * driver and reads their key.
 */
export function useDriverLocation(livreurId: string | null): DriverLocationEvent | undefined {
  const queryClient = useQueryClient();
  const { data } = useQuery<DriverLocationEvent | null>({
    queryKey: queryKeys.driverLocation(livreurId ?? ""),
    enabled: false,
    // Never fetched -- but TanStack v5 logs "No queryFn was passed" the
    // moment anything touches a queryFn-less entry (an invalidation sweep is
    // enough), and the tracking screen mounts this with livreurId "" while
    // the delivery loads. The queryFn is the cache read itself, so a stray
    // refetch is a no-op instead of a red console toast on device.
    queryFn: () =>
      livreurId === null
        ? null
        : (queryClient.getQueryData<DriverLocationEvent>(queryKeys.driverLocation(livreurId)) ??
          null),
    initialData: () =>
      livreurId === null
        ? undefined
        : queryClient.getQueryData<DriverLocationEvent>(queryKeys.driverLocation(livreurId)),
  });

  return livreurId === null ? undefined : (data ?? undefined);
}

/**
 * The last `delivery:status` event for this delivery, again written by the
 * bridge and never fetched.
 *
 * Held apart from the `Delivery` because the event's status string is not
 * always a DeliveryStatus -- the same channel carries OrderStatus values --
 * and writing it onto the cached object would either corrupt its type or
 * coerce a live "in_transit" into the enum's fallback and freeze the timeline.
 */
export function useDeliveryLiveStatus(deliveryId: string): DeliveryStatusEvent | undefined {
  const queryClient = useQueryClient();
  const { data } = useQuery<DeliveryStatusEvent | null>({
    queryKey: queryKeys.deliveryLiveStatus(deliveryId),
    enabled: false,
    // Same cache-read queryFn as useDriverLocation, for the same v5 warning.
    queryFn: () =>
      queryClient.getQueryData<DeliveryStatusEvent>(queryKeys.deliveryLiveStatus(deliveryId)) ??
      null,
    initialData: () =>
      queryClient.getQueryData<DeliveryStatusEvent>(queryKeys.deliveryLiveStatus(deliveryId)),
  });

  return data ?? undefined;
}
