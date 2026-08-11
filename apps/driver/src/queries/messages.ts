import { queryKeys, type Message } from "@kaya/core";
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
 * A delivery's chat thread.
 *
 * The delivery room is joined here, the same way the offers screen joins the
 * order room: rooms are opt-in on the gateway and the realtime bridge joins
 * none. Without it `chat:message` never fires and the thread simply stops
 * updating, with nothing to say why.
 *
 * Inbound messages are appended to this key by @kaya/core's cache policy,
 * which also dedupes by id -- the gateway rebroadcasts to the whole room
 * including the sender, so a message sent here comes back over the socket
 * after the REST POST already returned it.
 */
export function useMessages(deliveryId: string): UseQueryResult<Message[]> {
  useEffect(() => {
    socketService.joinDelivery(deliveryId);
    return () => socketService.leaveDelivery(deliveryId);
  }, [deliveryId]);

  return useQuery({
    queryKey: queryKeys.messages(deliveryId),
    queryFn: () => api.listMessages(deliveryId),
    enabled: deliveryId !== "",
  });
}

/**
 * Sends a message over REST rather than over the socket.
 *
 * The gateway has a `chat:message` handler and the legacy Dart client used it,
 * but a socket emit is fire-and-forget: it reports neither delivery nor
 * failure, so a message sent while the transport is quietly down disappears
 * with the composer cleared and nothing on screen. The REST call returns the
 * persisted message or an error, and the socket rebroadcast still arrives for
 * everyone else in the room.
 *
 * The response is written straight into the thread rather than invalidating
 * it: it *is* the message, and refetching a whole thread to learn what was
 * just returned would cost a round trip to learn nothing.
 */
export function useSendMessage(
  deliveryId: string,
): UseMutationResult<Message, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => api.sendMessage(deliveryId, { messageText: text.trim() }),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(queryKeys.messages(deliveryId), (previous) => {
        const existing = previous ?? [];
        // Same dedupe rule as the realtime bridge: the socket rebroadcast may
        // already have landed by the time this resolves.
        if (existing.some((m) => m.id === message.id)) return existing;
        return [...existing, message];
      });
    },
  });
}
