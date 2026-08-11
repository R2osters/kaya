import { queryKeys, type AddressSuggestion, type GeoPoint } from "@kaya/core";
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

/**
 * The address at a position, for "use my position".
 *
 * A mutation rather than a query: it is a one-shot answer to a button press,
 * not state a screen subscribes to, and caching it by coordinate would mean
 * every metre of GPS jitter minting a new entry for a value nobody re-reads.
 *
 * Never retried, and that is a deliberate limit rather than a safety rule:
 * this call is free of side effects, but the user is standing in a shop
 * waiting to type an address, and a silent retry chain is a button that looks
 * stuck. A failure resolves to the raw coordinate at the call site.
 */
export function useReverseGeocode(): UseMutationResult<
  AddressSuggestion | null,
  unknown,
  GeoPoint
> {
  const { i18n } = useTranslation();

  return useMutation({
    mutationFn: (point: GeoPoint) =>
      api.reverseGeocode({ lat: point.lat, lng: point.lng, language: i18n.language }),
  });
}
