import * as Messaging from "@react-native-firebase/messaging";
import { PushAdapter } from "./PushAdapter";

// @react-native-firebase/messaging's native module is not available under
// jest, so every call is mocked. The behaviour under test is how PushAdapter
// handles what the mock returns/resolves-with, not FCM itself. This targets
// the modular API (getMessaging/getToken/onMessage/...) the installed 26.x
// release actually ships -- there is no `messaging()` namespaced default
// export to fall back to.
jest.mock("@react-native-firebase/messaging", () => ({
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 },
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  hasPermission: jest.fn(),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  onTokenRefresh: jest.fn(),
  requestPermission: jest.fn(),
}));

const mockedGetToken = Messaging.getToken as jest.Mock;
const mockedHasPermission = Messaging.hasPermission as jest.Mock;
const mockedOnMessage = Messaging.onMessage as jest.Mock;
const mockedOnNotificationOpenedApp = Messaging.onNotificationOpenedApp as jest.Mock;
const mockedOnTokenRefresh = Messaging.onTokenRefresh as jest.Mock;
const mockedRequestPermission = Messaging.requestPermission as jest.Mock;
const { AuthorizationStatus } = Messaging;

// Flushes microtasks so the async-gated subscribe methods' internal awaits
// settle before assertions run -- onMessage/onNotificationOpened themselves
// return synchronously per the PushProvider contract.
const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe("PushAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requestPermission", () => {
    it('resolves "granted" when the OS authorizes', async () => {
      mockedRequestPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      const adapter = new PushAdapter();

      await expect(adapter.requestPermission()).resolves.toBe("granted");
    });

    it('resolves "granted" for provisional authorization (iOS quiet notifications)', async () => {
      mockedRequestPermission.mockResolvedValue(AuthorizationStatus.PROVISIONAL);
      const adapter = new PushAdapter();

      await expect(adapter.requestPermission()).resolves.toBe("granted");
    });

    it('resolves "denied" -- never rejects -- when the OS refuses', async () => {
      mockedRequestPermission.mockResolvedValue(AuthorizationStatus.DENIED);
      const adapter = new PushAdapter();

      await expect(adapter.requestPermission()).resolves.toBe("denied");
    });
  });

  describe("getToken", () => {
    it("a denied permission yields no token and does not throw", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.DENIED);
      const adapter = new PushAdapter();

      await expect(adapter.getToken()).resolves.toBeNull();
      expect(mockedGetToken).not.toHaveBeenCalled();
    });

    it("resolves a token when permission is granted", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      mockedGetToken.mockResolvedValue("fcm-token-1");
      const adapter = new PushAdapter();

      await expect(adapter.getToken()).resolves.toBe("fcm-token-1");
    });

    it("degrades a rejecting read to null instead of throwing", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      mockedGetToken.mockRejectedValue(new Error("registration not finished"));
      const adapter = new PushAdapter();

      await expect(adapter.getToken()).resolves.toBeNull();
    });
  });

  describe("onTokenRefresh", () => {
    it("fires the callback when the native listener fires", () => {
      let deliver: ((token: string) => void) | undefined;
      mockedOnTokenRefresh.mockImplementation((_messaging: unknown, cb: (token: string) => void) => {
        deliver = cb;
        return jest.fn();
      });
      const adapter = new PushAdapter();
      const received: string[] = [];

      adapter.onTokenRefresh((token) => received.push(token));
      deliver?.("fcm-token-2");

      expect(received).toEqual(["fcm-token-2"]);
    });

    it("subscribes immediately, without waiting on a permission check -- a stale token must never be silently dropped", () => {
      const adapter = new PushAdapter();
      adapter.onTokenRefresh(jest.fn());

      expect(mockedOnTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockedHasPermission).not.toHaveBeenCalled();
    });

    it("its unsubscribe detaches the native listener", () => {
      const remove = jest.fn();
      mockedOnTokenRefresh.mockReturnValue(remove);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onTokenRefresh(jest.fn());
      unsubscribe();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe is safe to call more than once", () => {
      const remove = jest.fn();
      mockedOnTokenRefresh.mockReturnValue(remove);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onTokenRefresh(jest.fn());

      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });

  describe("onMessage", () => {
    it("never subscribes when permission is not granted", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.DENIED);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onMessage(jest.fn());
      await flush();

      expect(mockedOnMessage).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("subscribes and normalizes a message when permission is granted", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      let deliver: ((message: unknown) => void) | undefined;
      mockedOnMessage.mockImplementation((_messaging: unknown, listener: (m: unknown) => void) => {
        deliver = listener;
        return jest.fn();
      });
      const adapter = new PushAdapter();
      const received: unknown[] = [];

      adapter.onMessage((m) => received.push(m));
      await flush();
      deliver?.({
        notification: { title: "Offer accepted!", body: "Head to the pickup location." },
        data: { type: "delivery", deliveryId: "d1" },
      });

      expect(received).toEqual([
        {
          type: "delivery",
          title: "Offer accepted!",
          body: "Head to the pickup location.",
          data: { type: "delivery", deliveryId: "d1" },
        },
      ]);
    });

    it("falls back to type \"system\" when the backend has not sent data.type", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      let deliver: ((message: unknown) => void) | undefined;
      mockedOnMessage.mockImplementation((_messaging: unknown, listener: (m: unknown) => void) => {
        deliver = listener;
        return jest.fn();
      });
      const adapter = new PushAdapter();
      const received: unknown[] = [];

      adapter.onMessage((m) => received.push(m));
      await flush();
      deliver?.({ data: { orderId: "ord1" } });

      expect((received[0] as { type: string }).type).toBe("system");
    });

    it("its unsubscribe detaches the native listener once established", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      const remove = jest.fn();
      mockedOnMessage.mockReturnValue(remove);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onMessage(jest.fn());
      await flush();
      unsubscribe();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("stops the subscription even when unsubscribe is called before the permission check resolves", async () => {
      // Mirrors LocationAdapter.watch's "unsubscribe before watchPositionAsync
      // resolves" test: a screen navigating away the instant it mounts must
      // not leak the native listener just because hasPermission() hadn't
      // resolved yet.
      let resolvePermission: ((status: number) => void) | undefined;
      mockedHasPermission.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          }),
      );
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onMessage(jest.fn());
      unsubscribe();
      resolvePermission?.(AuthorizationStatus.AUTHORIZED);
      await flush();

      expect(mockedOnMessage).not.toHaveBeenCalled();
    });

    it("does not blow up when the permission check rejects", async () => {
      mockedHasPermission.mockRejectedValue(new Error("native module unavailable"));
      const adapter = new PushAdapter();

      expect(() => adapter.onMessage(jest.fn())).not.toThrow();
      await flush();
    });
  });

  describe("onNotificationOpened", () => {
    it("never subscribes when permission is not granted", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.DENIED);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onNotificationOpened(jest.fn());
      await flush();

      expect(mockedOnNotificationOpenedApp).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("subscribes and normalizes a message when permission is granted", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      let deliver: ((message: unknown) => void) | undefined;
      mockedOnNotificationOpenedApp.mockImplementation(
        (_messaging: unknown, listener: (m: unknown) => void) => {
          deliver = listener;
          return jest.fn();
        },
      );
      const adapter = new PushAdapter();
      const received: unknown[] = [];

      adapter.onNotificationOpened((m) => received.push(m));
      await flush();
      deliver?.({ data: { type: "offer", offerId: "o1" } });

      expect(received).toEqual([
        { type: "offer", title: null, body: null, data: { type: "offer", offerId: "o1" } },
      ]);
    });

    it("its unsubscribe detaches the native listener", async () => {
      mockedHasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
      const remove = jest.fn();
      mockedOnNotificationOpenedApp.mockReturnValue(remove);
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onNotificationOpened(jest.fn());
      await flush();
      unsubscribe();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("stops the subscription even when unsubscribe is called before the permission check resolves", async () => {
      let resolvePermission: ((status: number) => void) | undefined;
      mockedHasPermission.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          }),
      );
      const adapter = new PushAdapter();

      const unsubscribe = adapter.onNotificationOpened(jest.fn());
      unsubscribe();
      resolvePermission?.(AuthorizationStatus.AUTHORIZED);
      await flush();

      expect(mockedOnNotificationOpenedApp).not.toHaveBeenCalled();
    });
  });
});
