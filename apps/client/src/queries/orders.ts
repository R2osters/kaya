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
 * Creates an order. That is the whole operation -- the backend publishes it.
 *
 * This originally called `POST /orders` then `POST /orders/:id/publish`, the
 * sequence the Dart original uses. On a device every submit failed with "Only
 * draft orders can be published": `OrdersService.create()` ends with
 * `if (!isScheduled) return this.publishInternal(order)`, so an immediate
 * order is already `published` by the time the response arrives, and the
 * second call is rejected by the status guard in `publish()`.
 *
 * The Dart client makes the same two calls, so the port reproduced a sequence
 * the backend refuses -- the same class of defect the phase 1A review found 22
 * of, and the reason the standing rule is that the backend is the contract
 * authority rather than the Dart client.
 *
 * When scheduling lands, nothing here changes: a scheduled order stays `draft`
 * and the backend's cron publishes it 30 minutes ahead. The publish endpoint
 * exists for a draft a user saved and later publishes by hand, which is not
 * this flow.
 */
export function useCreateOrder(): UseMutationResult<Order, unknown, NewOrderInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewOrderInput): Promise<Order> => {
      const description = input.description.trim();

      return api.createOrder({
        pickupAddress: input.pickup.label,
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        deliveryAddress: input.dropoff.label,
        deliveryLat: input.dropoff.lat,
        deliveryLng: input.dropoff.lng,
        ...(description === "" ? {} : { description }),
        dimensions: input.size,
      });
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
