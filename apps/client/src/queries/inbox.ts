import { queryKeys, type AppNotification, type Delivery, type NotificationsPage } from "@kaya/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * The signed-in user's deliveries, which are also their conversations: a
 * thread exists per delivery, with the driver as the counterpart. The inbox is
 * therefore a view over `GET /deliveries` rather than a separate resource --
 * same shape as the Dart original's inboxProvider.
 */
export function useMyDeliveries(): UseQueryResult<Delivery[]> {
  return useQuery({
    queryKey: queryKeys.deliveryList(),
    queryFn: () => api.listDeliveries(),
  });
}

/** The notification feed, newest first, with the unread count the badge shows. */
export function useNotifications(): UseQueryResult<NotificationsPage> {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.listNotifications(),
  });
}

/**
 * Marks one notification read, optimistically.
 *
 * Optimistic because the only visible effect is local -- the row's unread dot
 * and the badge count -- and waiting a round trip to clear a dot makes the
 * screen feel broken. On failure the cache is invalidated and the truth comes
 * back from the server; a dot reappearing is a smaller lie than one that never
 * clears.
 */
export function useMarkNotificationRead(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications() });
      queryClient.setQueryData<NotificationsPage>(queryKeys.notifications(), (previous) => {
        if (previous === undefined) return previous;
        const data = previous.data.map((n: AppNotification) =>
          n.id === id && n.readAt === null ? { ...n, readAt: new Date() } : n,
        );
        const wasUnread = previous.data.some((n) => n.id === id && n.readAt === null);
        return { ...previous, data, unread: Math.max(0, previous.unread - (wasUnread ? 1 : 0)) };
      });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}
