import { PushAdapter } from "@kaya/ui";
import { useEffect } from "react";
import { env } from "../config/env";
import { useAuthStore } from "../state/authStore";
import { registerPush } from "./registerPush";

/**
 * Registers push for the signed-in user, and tears the registration down when
 * the session ends.
 *
 * Mounted once, from the root layout, alongside the socket bridge. Gated on
 * `authenticated` because the token is stored against the user row: sending one
 * before sign-in has nowhere to land, and sending one after sign-out would
 * attach this device to whoever signs in next.
 *
 * `skipAuth` is excluded for the same reason the socket bridge excludes it --
 * there is no backend to register against in that configuration.
 *
 * The unsubscribe returned by `registerPush` arrives asynchronously, so the
 * cleanup may run before it exists. `pending` covers that: the effect records
 * whether it is still current, and a cleanup that ran first unsubscribes as
 * soon as the registration resolves.
 */
export function usePushRegistration(): void {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated" || env.skipAuth) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void registerPush(new PushAdapter()).then((teardown) => {
      if (cancelled) {
        teardown();
        return;
      }
      unsubscribe = teardown;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [status]);
}
