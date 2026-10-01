import { queryKeys, type Delivery, type DeliveryStatusEvent } from "@kaya/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../api/client";
import { socketService } from "../realtime/socket";

/**
 * One delivery, with its room joined for as long as the caller is mounted.
 *
 * The join is what unlocks `delivery:status` and `chat:message` for this
 * delivery: Socket.io rooms are opt-in, the realtime bridge deliberately joins
 * none, and only the screen knows which delivery it is running. Without it the
 * client's messages arrive nowhere and nothing says why.
 */
export function useDelivery(deliveryId: string): UseQueryResult<Delivery> {
  useEffect(() => {
    if (deliveryId === "") return;
    socketService.joinDelivery(deliveryId);
    return () => socketService.leaveDelivery(deliveryId);
  }, [deliveryId]);

  return useQuery({
    queryKey: queryKeys.delivery(deliveryId),
    queryFn: () => api.getDelivery(deliveryId),
    enabled: deliveryId !== "",
  });
}

/** Every delivery this driver has (`GET /deliveries` scopes by role). */
export function useMyDeliveries(): UseQueryResult<Delivery[]> {
  return useQuery({
    queryKey: queryKeys.deliveryList(),
    queryFn: () => api.listDeliveries(),
  });
}

/**
 * The one delivery the driver is in the middle of, if any.
 *
 * "In the middle of" is `status === "in_progress"`: `DeliveriesService`
 * creates a delivery in that state on acceptance and only leaves it on
 * confirm-delivery, cancel or dispute. A driver can hold several over time but
 * only ever runs one at a time, so the home screen shows it as a banner rather
 * than a list.
 */
export function useActiveDelivery(): Delivery | undefined {
  const { data } = useMyDeliveries();
  return data?.find((d) => d.status === "in_progress");
}

/** The last `delivery:status` event, written by the bridge and never fetched. */
export function useDeliveryLiveStatus(deliveryId: string): DeliveryStatusEvent | undefined {
  const queryClient = useQueryClient();
  const { data } = useQuery<DeliveryStatusEvent | null>({
    queryKey: queryKeys.deliveryLiveStatus(deliveryId),
    enabled: false,
    // The queryFn is the cache read itself: a queryFn-less entry makes
    // TanStack v5 log "No queryFn was passed" the moment an invalidation
    // sweep touches it, which put a red toast on every device run of the
    // client app.
    queryFn: () =>
      queryClient.getQueryData<DeliveryStatusEvent>(queryKeys.deliveryLiveStatus(deliveryId)) ??
      null,
    initialData: () =>
      queryClient.getQueryData<DeliveryStatusEvent>(queryKeys.deliveryLiveStatus(deliveryId)),
  });

  return data ?? undefined;
}

/**
 * The four steps of a run, each a POST that advances the state machine:
 * start -> pickup -> transit -> confirm-delivery.
 *
 * None of them retries. Every one is a state transition the backend guards
 * with the current status, so a replay is either a 400 the driver has to read
 * and dismiss, or -- for confirm-delivery -- a second attempt at settling
 * escrow. `useDeliveryAction` centralises that so a future step cannot be
 * added without inheriting the rule.
 *
 * On success the server's own delivery object is written straight into the
 * cache rather than invalidated: the transition response *is* the new state,
 * and a refetch would leave the action bar showing the old step for a beat on
 * a slow connection -- exactly when the driver is standing at a door waiting
 * to move on.
 */
function useDeliveryAction<TVariables>(
  deliveryId: string,
  action: (variables: TVariables) => Promise<Delivery>,
  alsoInvalidate: readonly (readonly unknown[])[] = [],
): UseMutationResult<Delivery, unknown, TVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onSuccess: (delivery) => {
      queryClient.setQueryData(queryKeys.delivery(deliveryId), delivery);
      void queryClient.invalidateQueries({ queryKey: queryKeys.deliveryList() });
      for (const queryKey of alsoInvalidate) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useStartDelivery(deliveryId: string): UseMutationResult<Delivery, unknown, void> {
  return useDeliveryAction(deliveryId, () => api.startDelivery(deliveryId));
}

/**
 * Pickup, with the photo the spec makes camera-only.
 *
 * `photoUrl` is optional on the backend (`DeliveryPhotoDto`), and it stays
 * optional here: a driver whose camera permission is refused, or whose phone
 * fails to encode the shot, must still be able to work. Blocking the run on
 * the photo would strand them at the pickup point.
 */
export function usePickupDelivery(
  deliveryId: string,
): UseMutationResult<Delivery, unknown, string | undefined> {
  return useDeliveryAction(deliveryId, (photoUrl?: string) =>
    api.pickupDelivery(deliveryId, photoUrl === undefined ? {} : { photoUrl }),
  );
}

export function useTransitDelivery(deliveryId: string): UseMutationResult<Delivery, unknown, void> {
  return useDeliveryAction(deliveryId, () => api.transitDelivery(deliveryId));
}

/**
 * Confirms delivery, which settles escrow: commission is taken, the driver's
 * balance moves, and the daily delivery counter -- which decides the next
 * run's commission tier -- increments. So this invalidates the whole
 * `["driver"]` subtree on top of the delivery itself.
 */
export function useConfirmDelivery(
  deliveryId: string,
): UseMutationResult<Delivery, unknown, string | undefined> {
  return useDeliveryAction(
    deliveryId,
    (photoUrl?: string) =>
      api.confirmDelivery(deliveryId, photoUrl === undefined ? {} : { photoUrl }),
    [queryKeys.driver()],
  );
}
