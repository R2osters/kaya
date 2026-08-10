import { queryKeys, type AddressSuggestion } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * Shortest query the backend will answer. `GeocodeSearchDto` rejects anything
 * shorter with a 400, so asking below this spends a round trip to be told off.
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * How long the field stays quiet before a request goes out.
 *
 * This is a type-ahead over a shared geocoding account: without it, "Accra"
 * is five requests, of which four are answers nobody reads. 300ms is the
 * usual sweet spot -- long enough to swallow a burst of keystrokes, short
 * enough that the list does not feel late.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/** Delays a changing value, so a fast typist produces one request rather than one per key. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Cleared on every change, so the timer only fires once typing pauses.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Address suggestions for what the user has typed.
 *
 * The country is deliberately not sent: the backend defaults it to the
 * caller's own, which is what a delivery app wants -- an unfiltered "Accra"
 * matches places on three continents, and one picked by a tired thumb prices a
 * delivery nobody can explain. Passing it from the app would mean mapping the
 * platform's three-letter code to the two-letter one the geocoder speaks, in a
 * second place, for no gain.
 *
 * `keepPreviousData` is on so the list does not blank out between keystrokes;
 * a list that empties and refills on every character is unreadable.
 */
export function useAddressSearch(text: string): UseQueryResult<AddressSuggestion[]> {
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const longEnough = debounced.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: queryKeys.addressSearch(debounced),
    queryFn: () => api.searchAddresses({ q: debounced }),
    enabled: longEnough,
    placeholderData: (previous) => previous,
    // Addresses do not move. Re-asking for the same string within a session is
    // spending someone's geocoding quota to get the same answer.
    staleTime: 5 * 60 * 1000,
  });
}
