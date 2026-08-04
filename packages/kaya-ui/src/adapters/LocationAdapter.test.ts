import * as Location from "expo-location";
import { LocationAdapter } from "./LocationAdapter";

// expo-location's native module is not available under jest, so every call
// is mocked. The behaviour under test is how LocationAdapter handles what the
// mock returns/resolves-with, not the native GPS itself.
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockedRequest = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockedGetPermissions = Location.getForegroundPermissionsAsync as jest.Mock;
const mockedGetCurrent = Location.getCurrentPositionAsync as jest.Mock;
const mockedWatch = Location.watchPositionAsync as jest.Mock;

// Flushes microtasks so the watch() IIFE's internal awaits settle before
// assertions run -- watch() itself returns synchronously per the
// LocationProvider contract.
const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe("LocationAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requestPermission", () => {
    it('resolves "granted" when the OS grants it', async () => {
      mockedRequest.mockResolvedValue({ status: "granted" });
      const adapter = new LocationAdapter();

      await expect(adapter.requestPermission()).resolves.toBe("granted");
    });

    it('resolves "denied" -- never rejects -- when the OS refuses', async () => {
      mockedRequest.mockResolvedValue({ status: "denied" });
      const adapter = new LocationAdapter();

      await expect(adapter.requestPermission()).resolves.toBe("denied");
    });
  });

  describe("getCurrent", () => {
    it("resolves null once permission is denied, rather than throwing", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "denied" });
      const adapter = new LocationAdapter();

      await expect(adapter.getCurrent()).resolves.toBeNull();
      expect(mockedGetCurrent).not.toHaveBeenCalled();
    });

    it("resolves a GeoPoint when permission is granted", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      mockedGetCurrent.mockResolvedValue({ coords: { latitude: 5.6, longitude: -0.19 } });
      const adapter = new LocationAdapter();

      await expect(adapter.getCurrent()).resolves.toEqual({ lat: 5.6, lng: -0.19 });
    });

    it("degrades a rejecting read to null instead of throwing", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      mockedGetCurrent.mockRejectedValue(new Error("no fix yet"));
      const adapter = new LocationAdapter();

      await expect(adapter.getCurrent()).resolves.toBeNull();
    });
  });

  describe("watch", () => {
    it("never subscribes when permission is not granted", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "denied" });
      const adapter = new LocationAdapter();

      const unsubscribe = adapter.watch(jest.fn(), { intervalMs: 5000, distanceFilterM: 10 });
      await flush();

      expect(mockedWatch).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("subscribes with the given interval and distance filter, and delivers updates", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      const remove = jest.fn();
      let deliver: ((position: unknown) => void) | undefined;
      mockedWatch.mockImplementation(async (_options: unknown, callback: (p: unknown) => void) => {
        deliver = callback;
        return { remove };
      });
      const adapter = new LocationAdapter();
      const received: unknown[] = [];

      adapter.watch((point) => received.push(point), { intervalMs: 5000, distanceFilterM: 10 });
      await flush();

      expect(mockedWatch).toHaveBeenCalledWith(
        expect.objectContaining({ timeInterval: 5000, distanceInterval: 10 }),
        expect.any(Function),
      );

      deliver?.({ coords: { latitude: 5.61, longitude: -0.2 } });
      expect(received).toEqual([{ lat: 5.61, lng: -0.2 }]);
    });

    it("returns an unsubscribe that genuinely stops the subscription", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      const remove = jest.fn();
      mockedWatch.mockResolvedValue({ remove });
      const adapter = new LocationAdapter();

      const unsubscribe = adapter.watch(jest.fn(), { intervalMs: 5000, distanceFilterM: 10 });
      await flush();
      unsubscribe();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("stops the subscription even when unsubscribe is called before watchPositionAsync resolves", async () => {
      // A driver navigating away from the run screen the instant it mounts
      // must not leak the subscription just because watchPositionAsync
      // hadn't resolved yet.
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      const remove = jest.fn();
      let resolveWatch: ((value: { remove: () => void }) => void) | undefined;
      mockedWatch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveWatch = resolve;
          }),
      );
      const adapter = new LocationAdapter();

      const unsubscribe = adapter.watch(jest.fn(), { intervalMs: 5000, distanceFilterM: 10 });
      // Let the permission check resolve and watchPositionAsync get called,
      // without yet resolving watchPositionAsync itself.
      await flush();
      expect(mockedWatch).toHaveBeenCalledTimes(1);

      unsubscribe();
      resolveWatch?.({ remove });
      await flush();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe is safe to call more than once", async () => {
      mockedGetPermissions.mockResolvedValue({ status: "granted" });
      const remove = jest.fn();
      mockedWatch.mockResolvedValue({ remove });
      const adapter = new LocationAdapter();

      const unsubscribe = adapter.watch(jest.fn(), { intervalMs: 5000, distanceFilterM: 10 });
      await flush();

      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("reports a watch that cannot be established instead of leaving it unhandled", async () => {
      // GPS switched off mid-run. Unhandled, this is a promise rejection that
      // some React Native configurations turn fatal — over something every
      // other method on this contract treats as recoverable.
      const failure = new Error("location services disabled");
      mockedWatch.mockRejectedValue(failure);
      mockedGetPermissions.mockResolvedValue({ status: "granted" });

      const onError = jest.fn();
      const adapter = new LocationAdapter();
      adapter.watch(jest.fn(), { intervalMs: 5_000, distanceFilterM: 10, onError });

      await flush();

      expect(onError).toHaveBeenCalledWith(failure);
    });

    it("does not blow up when no onError is supplied", async () => {
      mockedWatch.mockRejectedValue(new Error("location services disabled"));
      mockedGetPermissions.mockResolvedValue({ status: "granted" });

      const adapter = new LocationAdapter();
      expect(() =>
        adapter.watch(jest.fn(), { intervalMs: 5_000, distanceFilterM: 10 }),
      ).not.toThrow();

      await flush();
    });
  });
});
