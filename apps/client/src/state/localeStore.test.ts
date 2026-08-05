// The store reads through the real expo-secure-store module (mocked at the
// module boundary, not the store's own logic), same convention as
// authStore.test.ts: a rejecting read must degrade the same way a real
// keychain failure would, not just prove a stub behaves.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

import * as SecureStore from "expo-secure-store";
import { useLocaleStore } from "./localeStore";

const mockedGet = SecureStore.getItemAsync as jest.Mock;
const mockedSet = SecureStore.setItemAsync as jest.Mock;

describe("localeStore", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedSet.mockReset();
    useLocaleStore.setState({ locale: undefined });
  });

  it("starts with no locale -- KayaI18nProvider resolves that to its own default", () => {
    expect(useLocaleStore.getState().locale).toBeUndefined();
  });

  it("loads a previously saved, supported locale", async () => {
    mockedGet.mockResolvedValue("en");

    await useLocaleStore.getState().loadSavedLocale();

    expect(useLocaleStore.getState().locale).toBe("en");
  });

  it("leaves the locale undefined when nothing was ever saved", async () => {
    mockedGet.mockResolvedValue(null);

    await useLocaleStore.getState().loadSavedLocale();

    expect(useLocaleStore.getState().locale).toBeUndefined();
    expect(useLocaleStore.getState()).toMatchObject({ locale: undefined });
  });

  it("leaves the locale undefined for a saved value outside SUPPORTED_LOCALES", async () => {
    // A stale build's locale code, or a value some future migration leaves
    // behind -- either way this must fall back to the provider's default
    // rather than hand it a value it does not recognise.
    mockedGet.mockResolvedValue("es");

    await useLocaleStore.getState().loadSavedLocale();

    expect(useLocaleStore.getState().locale).toBeUndefined();
  });

  it("leaves the locale undefined when the keychain read rejects", async () => {
    mockedGet.mockRejectedValue(new Error("keychain unavailable"));

    await useLocaleStore.getState().loadSavedLocale();

    expect(useLocaleStore.getState().locale).toBeUndefined();
  });

  it("setLocale updates state immediately and persists the choice", async () => {
    await useLocaleStore.getState().setLocale("en");

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(mockedSet).toHaveBeenCalledWith("kaya.locale", "en");
  });
});
