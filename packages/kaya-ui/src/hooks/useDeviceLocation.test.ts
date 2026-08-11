import type { GeoPoint, LocationProvider, LocationWatchOptions } from "@kaya/core";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDeviceLocation } from "./useDeviceLocation";

const OSU: GeoPoint = { lat: 5.5606, lng: -0.1824 };
const LOME: GeoPoint = { lat: 6.1319, lng: 1.2228 };

/** A LocationProvider whose every answer the test controls. */
function fakeProvider(overrides: Partial<LocationProvider> = {}) {
  const stop = jest.fn();
  let emit: ((point: GeoPoint) => void) | null = null;
  let watchOptions: LocationWatchOptions | null = null;

  const provider: LocationProvider = {
    requestPermission: jest.fn().mockResolvedValue("granted"),
    getCurrent: jest.fn().mockResolvedValue(OSU),
    watch: jest.fn((callback, options) => {
      emit = callback;
      watchOptions = options;
      return stop;
    }),
    ...overrides,
  };

  return {
    provider,
    stop,
    emit: (point: GeoPoint) => act(() => emit?.(point)),
    get watchOptions() {
      return watchOptions;
    },
  };
}

describe("useDeviceLocation", () => {
  it("asks for nothing until told to", async () => {
    // A permission prompt on first open, before the app has shown what it
    // needs location for, is the one most often refused outright -- and on
    // Android a refusal is close to permanent.
    const { provider } = fakeProvider();

    const { result } = renderHook(() => useDeviceLocation({ provider }));

    expect(provider.requestPermission).not.toHaveBeenCalled();
    expect(result.current.permission).toBe("unknown");
    expect(result.current.position).toBeNull();
  });

  it("reads a first fix once permission is requested", async () => {
    const { provider } = fakeProvider();
    const { result } = renderHook(() => useDeviceLocation({ provider }));

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.permission).toBe("granted");
    expect(result.current.position).toEqual(OSU);
  });

  it("requests on mount when the screen has already earned it", async () => {
    const { provider } = fakeProvider();

    const { result } = renderHook(() => useDeviceLocation({ provider, requestOnMount: true }));

    await waitFor(() => expect(result.current.position).toEqual(OSU));
  });

  it("treats a refusal as a state, not an error", async () => {
    const { provider } = fakeProvider({
      requestPermission: jest.fn().mockResolvedValue("denied"),
    });
    const { result } = renderHook(() => useDeviceLocation({ provider }));

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.permission).toBe("denied");
    expect(result.current.position).toBeNull();
    expect(provider.getCurrent).not.toHaveBeenCalled();
  });

  it("does not watch unless asked -- a watch holds the GPS and the radio awake", async () => {
    const { provider } = fakeProvider();
    const { result } = renderHook(() => useDeviceLocation({ provider }));

    await act(async () => {
      await result.current.request();
    });

    expect(provider.watch).not.toHaveBeenCalled();
  });

  it("follows the position when watching, and reports each one", async () => {
    const onPosition = jest.fn();
    const fake = fakeProvider();
    const { result } = renderHook(() =>
      useDeviceLocation({ provider: fake.provider, watch: true, onPosition }),
    );

    await act(async () => {
      await result.current.request();
    });
    fake.emit(LOME);

    expect(onPosition).toHaveBeenCalledWith(LOME);
    expect(result.current.position).toEqual(LOME);
  });

  it("tears the watch down on unmount, so it cannot outlive the screen", async () => {
    const fake = fakeProvider();
    const { result, unmount } = renderHook(() =>
      useDeviceLocation({ provider: fake.provider, watch: true }),
    );

    await act(async () => {
      await result.current.request();
    });
    unmount();

    expect(fake.stop).toHaveBeenCalled();
  });

  it("reports a dead stream as a lost permission rather than pretending positions still flow", async () => {
    const fake = fakeProvider();
    const { result } = renderHook(() =>
      useDeviceLocation({ provider: fake.provider, watch: true }),
    );

    await act(async () => {
      await result.current.request();
    });
    act(() => fake.watchOptions?.onError?.(new Error("GPS off")));

    expect(result.current.permission).toBe("denied");
  });

  it("does not restart the watch when the caller passes a fresh callback each render", async () => {
    const fake = fakeProvider();
    const { result, rerender } = renderHook(() =>
      // An inline arrow: a new identity on every render.
      useDeviceLocation({ provider: fake.provider, watch: true, onPosition: () => undefined }),
    );

    await act(async () => {
      await result.current.request();
    });
    rerender({});
    rerender({});

    expect(fake.provider.watch).toHaveBeenCalledTimes(1);
  });
});
