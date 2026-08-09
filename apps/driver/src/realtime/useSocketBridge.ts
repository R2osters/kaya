import { applyRealtimeEvent, type RealtimeCache, type SocketEventMap } from "@kaya/core";
import { SecureTokenStore } from "@kaya/ui";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { env } from "../config/env";
import { useAuthStore } from "../state/authStore";
import { socketService } from "./socket";

/**
 * Every server-to-client event the gateway emits. Listed rather than derived
 * so adding one to @kaya/core without deciding what it does to the cache is a
 * compile error here (the array is typed against `keyof SocketEventMap`), not
 * a silently ignored event.
 */
const SERVER_EVENTS = [
  "offer:new",
  "offer:accepted",
  "offer:rejected",
  "location:driver",
  "delivery:status",
  "chat:message",
] as const satisfies readonly (keyof SocketEventMap)[];

/**
 * Adapts a react-query `QueryClient` to the two-method interface @kaya/core's
 * cache policy is written against, so the policy itself never imports
 * react-query. Exported for the tests, which assert against a real QueryClient.
 */
export function toRealtimeCache(queryClient: QueryClient): RealtimeCache {
  return {
    setQueryData: (key, updater) => {
      queryClient.setQueryData(key, updater);
    },
    invalidateQueries: (key) => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

/**
 * Subscribes one event, keeping `K` bound so the payload handed to
 * `applyRealtimeEvent` is the type that event actually carries. Inlining this
 * in the loop below would widen `event` to the union and lose that.
 */
function subscribe<K extends keyof SocketEventMap>(event: K, cache: RealtimeCache): () => void {
  return socketService.on(event, (payload) => {
    applyRealtimeEvent(cache, event, payload);
  });
}

/**
 * Connects the socket while a session exists, and routes every inbound event
 * into the query cache through @kaya/core's policy (see cacheBridge.ts there
 * for the write-vs-invalidate split and why it is a bandwidth decision).
 *
 * Mounted once, from the root layout. Three things are deliberate:
 *
 * - **Handlers are attached before connecting.** `SocketService` replays its
 *   registered listeners onto whatever socket `connect()` builds, so this
 *   order costs nothing -- but the reverse order has a real gap on a fast
 *   local backend, where the first events can arrive before the effect body
 *   finishes.
 * - **Rooms are not joined here.** Nothing arrives for an order or a delivery
 *   until a screen calls `joinOrder`/`joinDelivery`; Socket.io rooms are
 *   opt-in and the gateway subscribes nobody automatically. Phase 1B found
 *   this the hard way -- offer events could be subscribed to and would simply
 *   never fire. Joining belongs to the screen that cares, which is also the
 *   only thing that knows when to stop caring.
 * - **`skipAuth` does not connect.** That flag exists to open a screen with no
 *   backend running; dialling a socket at a host that is not there produces a
 *   reconnect loop and a stream of warnings for no benefit.
 */
export function useSocketBridge(): void {
  const status = useAuthStore((s) => s.status);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "authenticated" || env.skipAuth) {
      socketService.disconnect();
      return;
    }

    const cache = toRealtimeCache(queryClient);
    const unsubscribes = SERVER_EVENTS.map((event) => subscribe(event, cache));

    // The token is read from the keychain rather than the auth store: the
    // store holds the User, not the credential. `cancelled` covers the sign-out
    // that lands while this read is still in flight -- connecting after that
    // would open a socket with a token the app has already discarded.
    let cancelled = false;
    void new SecureTokenStore().readAccess().then((token) => {
      if (cancelled || token === null || token === "") return;
      socketService.connect(token);
    });

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
      socketService.disconnect();
    };
  }, [status, queryClient]);
}
