import * as SecureStore from "expo-secure-store";
import { SecureTokenStore } from "./SecureTokenStore";

// expo-secure-store's native module is not available under jest, so every
// call is mocked. The behaviour under test is how SecureTokenStore handles
// what the mock returns/throws, not the native keychain itself.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

const mockedGet = SecureStore.getItemAsync as jest.Mock;
const mockedSet = SecureStore.setItemAsync as jest.Mock;
const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;

describe("SecureTokenStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("round-trips a saved token pair", async () => {
    const backing = new Map<string, string>();
    mockedSet.mockImplementation(async (key: string, value: string) => {
      backing.set(key, value);
    });
    mockedGet.mockImplementation(async (key: string) => backing.get(key) ?? null);

    const store = new SecureTokenStore();
    await store.save({ accessToken: "access-1", refreshToken: "refresh-1" });

    expect(await store.readAccess()).toBe("access-1");
    expect(await store.readRefresh()).toBe("refresh-1");
  });

  it("uses the exact key names ported from the Flutter implementation", async () => {
    mockedSet.mockResolvedValue(undefined);
    mockedGet.mockResolvedValue(null);
    mockedDelete.mockResolvedValue(undefined);

    const store = new SecureTokenStore();
    await store.save({ accessToken: "a", refreshToken: "r" });
    await store.readAccess();
    await store.readRefresh();
    await store.clear();

    expect(mockedSet).toHaveBeenCalledWith("kaya.access_token", "a", expect.anything());
    expect(mockedSet).toHaveBeenCalledWith("kaya.refresh_token", "r", expect.anything());
    expect(mockedGet).toHaveBeenCalledWith("kaya.access_token", expect.anything());
    expect(mockedGet).toHaveBeenCalledWith("kaya.refresh_token", expect.anything());
    expect(mockedDelete).toHaveBeenCalledWith("kaya.access_token", expect.anything());
    expect(mockedDelete).toHaveBeenCalledWith("kaya.refresh_token", expect.anything());
  });

  it("clear removes both keys", async () => {
    mockedDelete.mockResolvedValue(undefined);

    const store = new SecureTokenStore();
    await store.clear();

    expect(mockedDelete).toHaveBeenCalledTimes(2);
  });

  it("degrades a rejecting read to null instead of throwing", async () => {
    mockedGet.mockRejectedValue(new Error("keychain unavailable"));

    const store = new SecureTokenStore();

    await expect(store.readAccess()).resolves.toBeNull();
    await expect(store.readRefresh()).resolves.toBeNull();
  });

  it("propagates a rejecting write instead of swallowing it", async () => {
    mockedSet.mockRejectedValue(new Error("keychain write failed"));

    const store = new SecureTokenStore();

    await expect(store.save({ accessToken: "a", refreshToken: "r" })).rejects.toThrow(
      "keychain write failed",
    );
  });

  it("propagates a rejecting clear, so a failed sign-out is not reported as done", async () => {
    // clear() is a write for this purpose. Swallowing its failure would leave
    // the tokens on the device while the app shows a signed-out screen — the
    // one outcome worse than a sign-out that visibly fails.
    mockedDelete.mockRejectedValue(new Error("keychain delete failed"));

    const store = new SecureTokenStore();

    await expect(store.clear()).rejects.toThrow("keychain delete failed");
  });
});
