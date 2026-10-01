import { queryKeys, type DriverBalance, type DriverStats } from "@kaya/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";

/**
 * Today's numbers: deliveries done, the commission tier they put the driver
 * in, and what has been earned since local midnight.
 *
 * The tier is the reason this is on the home screen rather than buried in a
 * stats page. Commission steps down at the 7th, 11th and 15th delivery of the
 * day (country timezone), so "one more run and my cut improves" is an
 * operational fact a driver acts on, not a statistic they browse.
 */
export function useDriverStats(): UseQueryResult<DriverStats> {
  return useQuery({
    queryKey: queryKeys.driverStats(),
    queryFn: () => api.driverStats(),
  });
}

/** Balance plus the last 20 ledger rows (`GET /driver/balance`). */
export function useDriverBalance(): UseQueryResult<DriverBalance> {
  return useQuery({
    queryKey: queryKeys.driverBalance(),
    queryFn: () => api.driverBalance(),
  });
}

/**
 * Goes online or offline (`POST /driver/status`).
 *
 * Not a preference but a precondition: `OffersService.create()` refuses a bid
 * from an offline driver, so a driver who never flipped this can do nothing at
 * all. The whole `["driver"]` subtree is invalidated on success because going
 * online is also what makes nearby work worth fetching.
 *
 * Never retried. The flag is the driver's own statement about whether they are
 * available; replaying a stale "online" after they closed the app would offer
 * them work they are not there to take.
 */
export function useSetOnline(): UseMutationResult<{ isOnline: boolean }, unknown, boolean> {
  const queryClient = useQueryClient();
  const setUser = useAuthStore.setState;

  return useMutation({
    mutationFn: (online: boolean) => api.setDriverStatus(online),
    onSuccess: ({ isOnline }) => {
      // Written into the auth store, not invalidated as a query. Nothing in
      // this app subscribes to `["auth","me"]` -- the store's `user` is the
      // only copy the screens read -- so invalidating that key is a no-op,
      // and the home screen would have gone on rendering the old flag: the
      // switch snapping back, the position never publishing, and the nearby
      // search staying disabled. The endpoint answers with the flag as it now
      // stands, which is the authoritative value.
      setUser((state) => (state.user === null ? state : { user: { ...state.user, isOnline } }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.driver() });
    },
  });
}
