import { queryKeys, type Delivery, type OrderOffers } from "@kaya/core";
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
 * The offers on an order, and a live subscription to new ones.
 *
 * Joining the room is the screen's job, not the realtime bridge's: Socket.io
 * rooms are opt-in, the bridge deliberately joins none, and only the screen
 * knows which order it is watching. Without the join, `offer:new` is
 * subscribed to and simply never fires -- the failure phase 1B found the hard
 * way, which produces no error anywhere.
 *
 * The bridge turns an inbound `offer:new` into an invalidation of this very
 * key (see applyRealtimeEvent in @kaya/core), so a new bid refetches the list
 * rather than being folded in half-built: the event carries four fields, not
 * an offer with its bidder summary.
 */
export function useOffers(orderId: string): UseQueryResult<OrderOffers> {
  useEffect(() => {
    socketService.joinOrder(orderId);
    // leaveOrder is a local dispatch filter, not a wire operation -- the
    // gateway has no leave handler. It stops this screen's events reaching
    // handlers once it is gone; the socket stays in the server-side room.
    return () => socketService.leaveOrder(orderId);
  }, [orderId]);

  return useQuery({
    queryKey: queryKeys.offers(orderId),
    queryFn: () => api.listOffers(orderId),
  });
}

/**
 * Accepts an offer, which creates the delivery.
 *
 * This is the money moment of the slice: accepting locks the price and commits
 * the client to it. It inherits `retry: false` from the QueryClient default
 * and must never opt out -- a replayed accept is a second delivery.
 */
export function useAcceptOffer(orderId: string): UseMutationResult<Delivery, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => api.acceptOffer(offerId),
    onSuccess: (delivery) => {
      // Accepting changes the order's status and every other offer's, so the
      // whole order subtree is stale rather than just this offer. The key
      // hierarchy makes that one call.
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.deliveries() });
      queryClient.setQueryData(queryKeys.delivery(delivery.id), delivery);
    },
  });
}
