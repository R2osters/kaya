import { queryKeys, type DriverEarning, type Withdrawal } from "@kaya/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";

/** Per-delivery payout rows (`GET /driver/earnings`). */
export function useDriverEarnings(): UseQueryResult<DriverEarning[]> {
  return useQuery({
    queryKey: queryKeys.driverEarnings(),
    queryFn: () => api.driverEarnings(),
  });
}

/** Past withdrawal requests, newest first (`GET /driver/withdrawals`). */
export function useWithdrawals(): UseQueryResult<Withdrawal[]> {
  return useQuery({
    queryKey: queryKeys.withdrawals(),
    queryFn: () => api.listWithdrawals(),
  });
}

export interface WithdrawalRequest {
  amount: number;
  method: "momo" | "bank_transfer";
  /** Shape is method-specific and validated by the backend; see the screen. */
  accountDetails: Record<string, string>;
}

/**
 * Requests a withdrawal (`POST /driver/withdraw`).
 *
 * The single most dangerous mutation in this app, and the one most obviously
 * not retryable: the backend debits the balance immediately to prevent
 * double-spend, then creates the withdrawal row and a pending ledger entry. A
 * replay is a second debit. It inherits `retry: false` from the QueryClient
 * default and must never opt out.
 *
 * One per local day is a backend rule (409 on the second), so the failure a
 * driver is most likely to see here is a conflict, not a network error --
 * which is why the screen renders the message rather than a generic retry.
 */
export function useRequestWithdrawal(): UseMutationResult<
  Withdrawal,
  unknown,
  WithdrawalRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: WithdrawalRequest) => api.requestWithdrawal(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals() });
      // The balance moved the moment this succeeded, and the driver is about
      // to look straight at it -- on the earnings screen, which reads the
      // query, and on the profile, which reads the auth store. The store is
      // refreshed explicitly because nothing subscribes to `["auth","me"]`,
      // so invalidating that key would change nothing on screen.
      void queryClient.invalidateQueries({ queryKey: queryKeys.driver() });
      void useAuthStore.getState().refreshUser();
    },
  });
}
