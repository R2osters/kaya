import { toApiFailure } from "@kaya/core";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./authStore";

/**
 * Failure kinds worth retrying: genuinely transient transport failures a
 * retry might resolve. Everything else -- validation, forbidden, notFound,
 * conflict, cancelled, unknown, and unauthorized -- will not get better by
 * asking again. Unauthorized in particular: the shared HTTP client (see
 * @kaya/core's createHttpClient) has already attempted a token refresh and
 * replayed the original request once, synchronously, before this can ever
 * surface here as an error.
 */
const RETRYABLE_KINDS = new Set(["network", "timeout"]);

/** Caps how many times a query re-attempts a network/timeout failure. */
const MAX_QUERY_RETRIES = 3;

function queryRetry(failureCount: number, error: unknown): boolean {
  const failure = toApiFailure(error);
  return RETRYABLE_KINDS.has(failure.kind) && failureCount < MAX_QUERY_RETRIES;
}

/** Exponential backoff, capped at 30s -- design doc §6's "retry exponentiel". */
function queryRetryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000);
}

/**
 * The shared HTTP client already clears the session (via the
 * setOnSessionExpired seam authStore.ts wires up) the moment a 401 survives
 * a refresh attempt -- before the rejected promise ever reaches react-query.
 * This handler exists anyway, at the react-query layer, so the rule stated in
 * design doc §6 ("un unauthorized après échec du refresh -> purge de
 * session") is something the QueryClient itself provably enforces, not only
 * a side effect of how the axios interceptor happens to be wired -- and it
 * covers any future query or mutation whose failure reaches here without
 * having gone through that interceptor at all.
 */
function clearSessionOnUnauthorized(error: unknown): void {
  const failure = toApiFailure(error);
  if (failure.kind === "unauthorized") {
    useAuthStore.setState({ status: "anonymous", user: null });
  }
}

/**
 * Builds a fresh QueryClient with Kaya's global error-handling policy:
 *
 * - Queries retry only `network`/`timeout` failures, with exponential
 *   backoff, up to MAX_QUERY_RETRIES -- everything else (validation,
 *   forbidden, notFound, conflict, unauthorized, cancelled, unknown) fails
 *   immediately, once.
 * - Mutations never retry, full stop. This is the money-safety rule: a
 *   payment or withdrawal mutation must never be silently replayed, and
 *   rather than trust every future mutation call site to remember to opt
 *   out individually, the *default itself* is "do not retry". A caller that
 *   genuinely needs mutation retries (there is no such caller on a money
 *   path) would have to opt in explicitly, per call.
 * - An `unauthorized` failure, from either a query or a mutation, clears the
 *   session so the route guard redirects to /welcome.
 *
 * A factory rather than a bare singleton so tests can build an isolated
 * instance per case (see queryClient.test.tsx) -- `queryClient` below is the
 * one real app instance, exported for `_layout.tsx`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: queryRetry,
        retryDelay: queryRetryDelay,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({ onError: clearSessionOnUnauthorized }),
    mutationCache: new MutationCache({ onError: clearSessionOnUnauthorized }),
  });
}

/** Singleton QueryClient, shared by every screen -- see app/_layout.tsx. */
export const queryClient = createQueryClient();
