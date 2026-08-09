import type { PushMessage, PushProvider } from "@kaya/core";
import { registerPush } from "./registerPush";

const mockUpdateProfile = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

/**
 * A PushProvider whose token rotations a test can fire by hand, so the
 * behaviour that actually matters -- re-registering on rotation -- is testable
 * without FCM.
 */
function fakePush(overrides: Partial<PushProvider> = {}) {
  const refreshHandlers: ((token: string) => void)[] = [];
  const unsubscribe = jest.fn();

  const provider: PushProvider = {
    requestPermission: jest.fn().mockResolvedValue("granted"),
    getToken: jest.fn().mockResolvedValue("token-1"),
    onTokenRefresh: (callback) => {
      refreshHandlers.push(callback);
      return unsubscribe;
    },
    // Present to satisfy PushProvider; registerPush does not use either.
    onMessage: (callback: (message: PushMessage) => void) => {
      void callback;
      return () => undefined;
    },
    onNotificationOpened: (callback: (message: PushMessage) => void) => {
      void callback;
      return () => undefined;
    },
    ...overrides,
  };

  return {
    provider,
    unsubscribe,
    rotate: (token: string) => {
      for (const handler of refreshHandlers) handler(token);
    },
    refreshHandlerCount: () => refreshHandlers.length,
  };
}

beforeEach(() => {
  mockUpdateProfile.mockReset();
  mockUpdateProfile.mockResolvedValue(undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("registerPush", () => {
  it("asks for permission and sends the current token to the backend", async () => {
    const { provider } = fakePush();

    await registerPush(provider);

    expect(provider.requestPermission).toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith({ fcmToken: "token-1" });
  });

  it("re-sends the token on every rotation", async () => {
    // The whole reason this is not a single getToken() call: a stale token
    // means a driver silently stops being offered work.
    const fake = fakePush();
    await registerPush(fake.provider);
    mockUpdateProfile.mockClear();

    fake.rotate("token-2");
    fake.rotate("token-3");
    await Promise.resolve();

    expect(mockUpdateProfile).toHaveBeenNthCalledWith(1, { fcmToken: "token-2" });
    expect(mockUpdateProfile).toHaveBeenNthCalledWith(2, { fcmToken: "token-3" });
  });

  it("subscribes to rotation before reading the first token", async () => {
    // A rotation landing during the initial read would otherwise be lost.
    const fake = fakePush({
      getToken: jest.fn().mockImplementation(async () => {
        expect(fake.refreshHandlerCount()).toBe(1);
        return "token-1";
      }),
    });

    await registerPush(fake.provider);

    expect(fake.provider.getToken).toHaveBeenCalled();
  });

  it("sends nothing when permission is denied and no token is issued", async () => {
    const { provider } = fakePush({
      requestPermission: jest.fn().mockResolvedValue("denied"),
      getToken: jest.fn().mockResolvedValue(null),
    });

    await registerPush(provider);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("still listens for rotation after a denial, since permission can be granted later", async () => {
    const fake = fakePush({
      requestPermission: jest.fn().mockResolvedValue("denied"),
      getToken: jest.fn().mockResolvedValue(null),
    });
    await registerPush(fake.provider);

    fake.rotate("token-after-grant");
    await Promise.resolve();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ fcmToken: "token-after-grant" });
  });

  it("treats an empty-string token as no token", async () => {
    const { provider } = fakePush({ getToken: jest.fn().mockResolvedValue("") });

    await registerPush(provider);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("does not reject when the backend refuses the token", async () => {
    // An unhandled rejection from a fire-and-forget effect in the root layout
    // takes the app down; degraded notifications do not.
    mockUpdateProfile.mockRejectedValue(new Error("500"));
    const { provider } = fakePush();

    // `typeof` rather than toBeInstanceOf(Function): jest-expo runs the test
    // in its own realm, so a function built there is not an instance of this
    // realm's Function constructor.
    await expect(registerPush(provider)).resolves.toEqual(expect.any(Function));
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not reject when a rotation fails to reach the backend", async () => {
    const fake = fakePush();
    await registerPush(fake.provider);
    mockUpdateProfile.mockRejectedValue(new Error("500"));

    expect(() => fake.rotate("token-2")).not.toThrow();
    await Promise.resolve();
  });

  it("returns the rotation unsubscribe", async () => {
    const fake = fakePush();

    const teardown = await registerPush(fake.provider);
    teardown();

    expect(fake.unsubscribe).toHaveBeenCalled();
  });
});
