import { ApiConfig, KayaApi, createHttpClient } from "@kaya/core";
import { SecureTokenStore } from "@kaya/ui";
import { env } from "../config/env";

/** Singleton API configuration, built from runtime env -- see src/config/env.ts. */
export const apiConfig = new ApiConfig({ baseUrl: env.apiBaseUrl });

const tokenStore = new SecureTokenStore();

/**
 * Seam for Task 3's auth store. `createHttpClient` needs a session-expiry
 * callback wired in at construction time, but the store that owns what
 * "session expired" means (clear the session, let the route guard redirect
 * to /welcome) is built in Task 3, after this module. Task 3 calls
 * `setOnSessionExpired` once during its own setup to replace this default.
 *
 * Until then, a 401 that survives a failed token refresh still clears the
 * token store (createHttpClient's own behaviour, in @kaya/core) but nothing
 * routes the user anywhere -- this default only warns, so a forgotten
 * wire-up in Task 3 fails loudly in the console instead of silently leaving
 * the user on a blank screen.
 */
let onSessionExpired: () => void | Promise<void> = () => {
  console.warn(
    "[api/client] Session expired but no handler is wired yet -- " +
      "call setOnSessionExpired from the auth store (phase 1C task 3).",
  );
};

export function setOnSessionExpired(handler: () => void | Promise<void>): void {
  onSessionExpired = handler;
}

/** Singleton axios instance, shared by every call the app makes. */
export const httpClient = createHttpClient({
  config: apiConfig,
  store: tokenStore,
  onSessionExpired: () => onSessionExpired(),
});

/** Singleton typed REST surface, built on the shared httpClient above. */
export const api = new KayaApi(httpClient);
