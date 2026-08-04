import type { PushMessage, PushProvider } from "./push";
import { toPushMessage } from "./push";

/**
 * A minimal, non-platform implementation used only to verify the shape of
 * PushProvider — that a conforming implementation can satisfy the contract
 * with plain data, and that each subscription method's unsubscribe
 * genuinely stops delivery. The real
 * @react-native-firebase/messaging-backed adapter lives in @kaya/ui and is
 * tested there; this file has no platform dependency, matching @kaya/core's
 * "declare the interface, no runtime import" rule.
 */
class FakePushProvider implements PushProvider {
  permission: "granted" | "denied" = "granted";
  private token: string | null = "fake-token-1";
  private refreshListeners = new Set<(token: string) => void>();
  private messageListeners = new Set<(message: PushMessage) => void>();
  private openedListeners = new Set<(message: PushMessage) => void>();

  async requestPermission(): Promise<"granted" | "denied"> {
    return this.permission;
  }

  async getToken(): Promise<string | null> {
    if (this.permission !== "granted") {
      return null;
    }
    return this.token;
  }

  onTokenRefresh(callback: (token: string) => void): () => void {
    this.refreshListeners.add(callback);
    return () => {
      this.refreshListeners.delete(callback);
    };
  }

  onMessage(callback: (message: PushMessage) => void): () => void {
    if (this.permission !== "granted") {
      return () => {};
    }
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  onNotificationOpened(callback: (message: PushMessage) => void): () => void {
    if (this.permission !== "granted") {
      return () => {};
    }
    this.openedListeners.add(callback);
    return () => {
      this.openedListeners.delete(callback);
    };
  }

  /** Test helpers: simulate the platform emitting events. */
  emitTokenRefresh(token: string): void {
    this.token = token;
    for (const listener of this.refreshListeners) {
      listener(token);
    }
  }

  emitMessage(message: PushMessage): void {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  emitNotificationOpened(message: PushMessage): void {
    for (const listener of this.openedListeners) {
      listener(message);
    }
  }
}

describe("PushProvider contract", () => {
  it("requestPermission resolves the literal union, never rejects", async () => {
    const provider = new FakePushProvider();
    await expect(provider.requestPermission()).resolves.toBe("granted");
  });

  it("getToken resolves null (not a rejection) once permission is denied", async () => {
    const provider = new FakePushProvider();
    provider.permission = "denied";

    await expect(provider.getToken()).resolves.toBeNull();
  });

  it("getToken resolves a token when permission is granted", async () => {
    const provider = new FakePushProvider();
    await expect(provider.getToken()).resolves.toBe("fake-token-1");
  });

  it("onTokenRefresh delivers the new token to subscribers", () => {
    const provider = new FakePushProvider();
    const received: string[] = [];

    const unsubscribe = provider.onTokenRefresh((token) => received.push(token));
    provider.emitTokenRefresh("fake-token-2");

    expect(received).toEqual(["fake-token-2"]);
    unsubscribe();
  });

  it("onTokenRefresh's returned unsubscribe genuinely stops delivery", () => {
    const provider = new FakePushProvider();
    const received: string[] = [];

    const unsubscribe = provider.onTokenRefresh((token) => received.push(token));
    unsubscribe();
    provider.emitTokenRefresh("fake-token-3");

    expect(received).toEqual([]);
  });

  it("unsubscribe is safe to call more than once", () => {
    const provider = new FakePushProvider();
    const unsubscribe = provider.onTokenRefresh(() => {});

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });

  it("onMessage delivers messages to subscribers", () => {
    const provider = new FakePushProvider();
    const received: PushMessage[] = [];
    const message = toPushMessage({
      title: "Offer accepted!",
      body: "Head to the pickup location.",
      data: { type: "delivery", deliveryId: "d1" },
    });

    const unsubscribe = provider.onMessage((m) => received.push(m));
    provider.emitMessage(message);

    expect(received).toEqual([message]);
    unsubscribe();
  });

  it("onNotificationOpened delivers messages to subscribers", () => {
    const provider = new FakePushProvider();
    const received: PushMessage[] = [];
    const message = toPushMessage({ data: { type: "offer", offerId: "o1" } });

    const unsubscribe = provider.onNotificationOpened((m) => received.push(m));
    provider.emitNotificationOpened(message);

    expect(received).toEqual([message]);
    unsubscribe();
  });
});

describe("toPushMessage", () => {
  it("passes through a recognized type", () => {
    const message = toPushMessage({
      title: "New offer received",
      body: "A driver offered 25.00 for your delivery.",
      data: { type: "offer", offerId: "o1", orderId: "ord1" },
    });

    expect(message).toEqual({
      type: "offer",
      title: "New offer received",
      body: "A driver offered 25.00 for your delivery.",
      data: { type: "offer", offerId: "o1", orderId: "ord1" },
    });
  });

  it("falls back to system when data.type is missing -- the current backend gap", () => {
    // Mirrors reality: NotificationsService does not put `type` in the FCM
    // data payload today, only in the persisted Notification row.
    const message = toPushMessage({ data: { orderId: "ord1" } });

    expect(message.type).toBe("system");
  });

  it("falls back to system when data.type is unrecognized", () => {
    const message = toPushMessage({ data: { type: "not-a-real-type" } });

    expect(message.type).toBe("system");
  });

  it("defaults title, body and data when omitted entirely", () => {
    const message = toPushMessage({});

    expect(message).toEqual({ type: "system", title: null, body: null, data: {} });
  });

  it("null title/body pass through as null rather than being coerced", () => {
    const message = toPushMessage({ title: null, body: null, data: {} });

    expect(message.title).toBeNull();
    expect(message.body).toBeNull();
  });
});
