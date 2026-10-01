import type { GeoPoint } from "@kaya/core";
import { act, renderHook } from "@testing-library/react-native";
import { useSmoothedPoint } from "./useSmoothedPoint";

/** Osu, Accra — the fixture the rest of the suite uses as a start point. */
const OSU = { lat: 5.5606, lng: -0.1824 };
/** ~55m north of OSU: a normal five-second hop for a motorbike in traffic. */
const NEARBY = { lat: 5.5611, lng: -0.1824 };

let mockReducedMotion = false;
jest.mock("./useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useSmoothedPoint", () => {
  it("adopts the first position outright", () => {
    // Nowhere to travel from: sliding in from the previous frame's nothing
    // would be inventing a journey.
    const { result } = renderHook(() => useSmoothedPoint(OSU));

    expect(result.current).toEqual(OSU);
  });

  it("returns undefined while there is no position at all", () => {
    const { result } = renderHook(() => useSmoothedPoint(undefined));

    expect(result.current).toBeUndefined();
  });

  it("travels to a new position instead of jumping to it", () => {
    const { result, rerender } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: NEARBY });
    act(() => {
      jest.advanceTimersByTime(450);
    });

    // Halfway through the travel: between the two, and at neither.
    const mid = result.current;
    expect(mid).toBeDefined();
    expect(mid?.lat).toBeGreaterThan(OSU.lat);
    expect(mid?.lat).toBeLessThan(NEARBY.lat);
  });

  it("arrives exactly on the target", () => {
    const { result, rerender } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: NEARBY });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current).toEqual(NEARBY);
  });

  it("replaces rather than travels when the position jumps kilometres", () => {
    // A GPS re-acquisition, or a driver resuming after a tunnel. Animating it
    // would draw a confident straight line through streets nobody drove down.
    const tema = { lat: 5.6698, lng: -0.0166 };
    const { result, rerender } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: tema });

    expect(result.current).toEqual(tema);
  });

  it("snaps when the user has asked for less motion", () => {
    mockReducedMotion = true;
    const { result, rerender } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: NEARBY });

    expect(result.current).toEqual(NEARBY);
  });

  it("ignores a fresh object carrying the position it already shows", () => {
    // The socket hands back a new object on every tick; a driver stopped at a
    // junction must not restart the travel five times a minute.
    const { result, rerender } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: { ...OSU } });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current).toEqual(OSU);
  });

  it("stops its timer when unmounted mid-travel", () => {
    const { rerender, unmount } = renderHook<GeoPoint | undefined, { p: GeoPoint }>(({ p }) => useSmoothedPoint(p), {
      initialProps: { p: OSU },
    });

    rerender({ p: NEARBY });
    unmount();

    // A timer still firing after unmount is a setState on a dead component --
    // which is a warning today and a leak in any case.
    expect(jest.getTimerCount()).toBe(0);
  });
});
