import { queryKeys, type AddressSuggestion, type Order } from "@kaya/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";

/** What create-order collects before it can submit. */
export interface NewOrderInput {
  pickup: AddressSuggestion;
  dropoff: AddressSuggestion;
  /** Free text; omitted from the request when blank. */
  description: string;
  /** 'S' | 'M' | 'L', sent as the backend's `dimensions`. */
  size: string;
}

/**
 * Creates an order and publishes it, as one operation.
 *
 * The two calls are deliberately not exposed separately. `POST /orders` leaves
 * an order in `draft`, and only `POST /orders/:id/publish` puts it in front of
 * drivers -- an order created and not published is invisible to everyone
 * including the client who created it, with nothing on screen to say so. The
 * Dart original made both calls back to back for the same reason; splitting
 * them here would just move the chance of forgetting the second one into every
 * future caller.
 *
 * When scheduling lands the publish step becomes conditional (a scheduled
 * order is published by the backend's cron, 30 minutes ahead), which is the
 * one thing this function will need to learn.
 *
 * **A failed publish is reported, not swallowed.** The order exists at that
 * point, so silently resolving would leave a draft the user believes is live.
 */
export function useCreateOrder(): UseMutationResult<Order, unknown, NewOrderInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewOrderInput): Promise<Order> => {
      const description = input.description.trim();

      const order = await api.createOrder({
        pickupAddress: input.pickup.label,
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        deliveryAddress: input.dropoff.label,
        deliveryLat: input.dropoff.lat,
        deliveryLng: input.dropoff.lng,
        ...(description === "" ? {} : { description }),
        dimensions: input.size,
      });

      return api.publishOrder(order.id);
    },
    onSuccess: (order) => {
      // The list is stale the moment an order joins it, and the detail entry is
      // seeded so the offers screen this routes to does not refetch what the
      // response already carried.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      queryClient.setQueryData(queryKeys.order(order.id), order);
    },
  });
}
