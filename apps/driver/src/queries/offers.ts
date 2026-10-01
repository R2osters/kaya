import { queryKeys, type Offer, type Order } from "@kaya/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * The order being bid on. The nearby list already carries most of this, but a
 * bid screen reached from a push notification or a resumed app has no list
 * behind it -- and `minPriceSuggested`, which the whole screen is arranged
 * around, is a floor the backend enforces. Reading it from the order rather
 * than from a navigation param means the two cannot disagree.
 */
export function useOrder(orderId: string): UseQueryResult<Order & { offersCount: number }> {
  return useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: () => api.getOrder(orderId),
    enabled: orderId !== "",
  });
}

/**
 * Places a bid (`POST /orders/:orderId/offers`).
 *
 * Never retried, and the reason is the backend's own UNIQUE(order_id,
 * livreur_id): one bid per driver per order. A replayed request does not
 * create a second bid, it returns 409 -- so a retry can only turn a bid that
 * succeeded into an error message the driver believes.
 */
export function useCreateOffer(orderId: string): UseMutationResult<Offer, unknown, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposedPrice: number) => api.createOffer(orderId, { proposedPrice }),
    onSuccess: () => {
      // The order now has one more offer and may have moved to
      // offers_received; the nearby list is how the driver sees what is still
      // open to them.
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nearbyOrders() });
    },
  });
}
