import type { AddressSuggestion } from "@kaya/core";
import { create } from "zustand";

/** Which of create-order's two address fields the search was opened for. */
export type AddressField = "pickup" | "dropoff";

interface AddressSelectionState {
  /** The field awaiting a result, or null when no search is in flight. */
  target: AddressField | null;
  /** What the user picked, until the opener consumes it. */
  selection: AddressSuggestion | null;
  /** Called by the opener before navigating to /address-search. */
  open: (target: AddressField) => void;
  /** Called by the search screen once the user picks a row. */
  select: (suggestion: AddressSuggestion) => void;
  /**
   * Called by the opener once it has read the selection. Clearing is the
   * opener's job, not the search screen's: the value has to survive the
   * navigation back, and only the opener knows when it has been applied.
   */
  consume: () => void;
}

/**
 * Carries a chosen address from `/address-search` back to whoever opened it.
 *
 * The Dart original awaited a pushed route's result (`await context.push(...)`,
 * which go_router supports). Expo Router has no equivalent -- navigation does
 * not return a value -- so the result travels through this store instead:
 * the opener records which field it is filling, navigates, and reads the
 * selection when it comes back into focus.
 *
 * It is a store rather than a router param because a `GeoPoint` in a URL is a
 * URL that can be edited, truncated or restored from history with coordinates
 * that never came from the geocoder. The price of a delivery is computed from
 * these two numbers.
 */
export const useAddressSelectionStore = create<AddressSelectionState>((set) => ({
  target: null,
  selection: null,

  open: (target) => set({ target, selection: null }),
  select: (suggestion) => set({ selection: suggestion }),
  consume: () => set({ target: null, selection: null }),
}));
