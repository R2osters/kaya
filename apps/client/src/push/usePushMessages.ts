import { queryKeys, type PushMessage } from "@kaya/core";
import { PushAdapter } from "@kaya/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { env } from "../config/env";
import { useAuthStore } from "../state/authStore";
import { notificationRoute } from "./notificationRoute";

/**
 * Acts on inbound pushes: refreshes what they announce, and routes a tap.
 *
 * Registration (`usePushRegistration`) only tells the backend where to send
 * them. Until this existed nothing listened: a push arriving while the app was
 * open did nothing at all, and tapping one from the tray opened the app on
 * whatever screen it had been left on. The notification was delivered and then
 * discarded, which is the same as not sending it.
 *
 * Two channels, two jobs:
 *
 *  - `onMessage` fires while the app is foregrounded. The OS shows nothing in
 *    that state, so the only useful response is to make the screen the user is
 *    already looking at correct: invalidate the feed (the bell's unread count)
 *    and whatever the push is about. Deliberately *not* a navigation -- yanking
 *    someone out of a screen they chose, because a message arrived, is how an
 *    app loses a half-typed address.
 *  - `onNotificationOpened` fires when a tap brings the app up. That is an
 *    explicit request to go somewhere, so it navigates.
 *
 * Mounted once from the root layout, gated on an authenticated session for the
 * same reason registration is.
 */
export function usePushMessages(): void {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Held in refs so the subscription effect depends on the session alone. A
  // router or client identity change must not tear down and re-establish the
  // native listeners.
  const routerRef = useRef(router);
  routerRef.current = router;
  const clientRef = useRef(queryClient);
  clientRef.current = queryClient;

  useEffect(() => {
    if (status !== "authenticated" || env.skipAuth) return;

    const adapter = new PushAdapter();

    const refresh = (message: PushMessage) => {
      const client = clientRef.current;
      // The feed and its unread count, always: every push has a row behind it.
      void client.invalidateQueries({ queryKey: queryKeys.notifications() });

      const deliveryId = message.data["deliveryId"];
      const orderId = message.data["orderId"] ?? message.data["reminderFor"];
      if (deliveryId !== undefined) {
        void client.invalidateQueries({ queryKey: queryKeys.delivery(deliveryId) });
        void client.invalidateQueries({ queryKey: queryKeys.deliveryList() });
      }
      if (orderId !== undefined) {
        // The key hierarchy makes this reach the order and its offers at once.
        void client.invalidateQueries({ queryKey: queryKeys.order(orderId) });
        void client.invalidateQueries({ queryKey: queryKeys.orderList() });
      }
    };

    const stopForeground = adapter.onMessage(refresh);
    const stopOpened = adapter.onNotificationOpened((message) => {
      refresh(message);
      const target = notificationRoute(message.type, message.data);
      // No route means the payload named nothing openable. The notification
      // list is always truthful: whatever it was, it is in there.
      routerRef.current.push(target ?? "/notifications");
    });

    return () => {
      stopForeground();
      stopOpened();
    };
  }, [status]);
}
