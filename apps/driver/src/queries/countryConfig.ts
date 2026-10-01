import { queryKeys, type CountryConfig } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";

/**
 * How long a tariff card is treated as fresh.
 *
 * Commission tiers and the litigation fee are changed by an admin, in another
 * app, a handful of times a year. Refetching them alongside the data they
 * annotate would be a request per screen for a row that has not moved since
 * the country launched.
 */
const CONFIG_STALE_MS = 60 * 60 * 1000;

/**
 * The signed-in driver's own country configuration.
 *
 * Everything money-shaped on this side reads from it: the bid screen's
 * commission preview needs the tier table and the litigation fee, and the
 * withdrawal screen must only offer methods the country actually has. The
 * project's rule is that none of those may be constants in the app -- the day
 * Togo's tiers diverge from Ghana's, a hardcoded preview disagrees with the
 * ledger the driver is paid from.
 */
export function useCountryConfig(): UseQueryResult<CountryConfig> {
  const countryCode = useAuthStore((s) => s.user?.countryCode);

  return useQuery({
    queryKey: queryKeys.countryConfig(countryCode ?? ""),
    queryFn: () => api.countryConfig(countryCode ?? ""),
    enabled: countryCode !== undefined,
    staleTime: CONFIG_STALE_MS,
  });
}
