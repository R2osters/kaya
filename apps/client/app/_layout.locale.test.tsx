import { render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import RootLayout from "./_layout";

// This file exercises the one path task 4's brief calls out specifically:
// the app reads a saved language asynchronously (through the real, unmocked
// localeStore.ts -- only its expo-secure-store dependency is faked) and
// re-renders with the resolved value passed as KayaI18nProvider's controlled
// `locale` prop. _layout.test.tsx covers the auth guard with both stores
// mocked wholesale; this file is the complement, proving the wiring that
// feeds KayaI18nProvider rather than the guard.

// The three startup services RootLayout mounts are stubbed here: each has its
// own dedicated suite (src/map/register.test.tsx,
// src/realtime/useSocketBridge.test.tsx, src/push/usePushRegistration.test.tsx),
// and running the real ones here would drag @kaya/ui's native-backed adapters
// into a test about the locale prop.
jest.mock("../src/map/register", () => ({ registerAppMapProvider: jest.fn() }));
jest.mock("../src/realtime/useSocketBridge", () => ({ useSocketBridge: jest.fn() }));
jest.mock("../src/push/usePushRegistration", () => ({ usePushRegistration: jest.fn() }));

jest.mock("expo-router", () => ({
  Stack: () => null,
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/splash",
  useGlobalSearchParams: () => ({}),
}));

// authStore stays mocked exactly as in _layout.test.tsx: unrelated to this
// path, and mocking it avoids pulling in expo-secure-store's ACCESS/REFRESH
// keys alongside the locale key under test.
jest.mock("../src/state/authStore", () => {
  const useAuthStore = (selector: (state: { status: string; user: null }) => unknown) =>
    selector({ status: "unknown", user: null });
  Object.assign(useAuthStore, {
    getState: () => ({ status: "unknown", user: null, restoreSession: jest.fn() }),
  });
  return { useAuthStore };
});

// KayaI18nProvider is the one thing mocked here: a thin capture so the prop
// RootLayout actually passes is observable, without re-testing how the real
// provider reacts to it -- that mechanism already has full coverage in
// @kaya/ui's own KayaI18nProvider.test.tsx ("follows a changed locale prop
// after mount, without needing setLocale or a remount").
const capturedLocaleProps: (string | undefined)[] = [];
jest.mock("@kaya/ui", () => ({
  KayaI18nProvider: ({ locale, children }: { locale?: string; children: ReactNode }) => {
    capturedLocaleProps.push(locale);
    return children;
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

import * as SecureStore from "expo-secure-store";
import { useLocaleStore } from "../src/state/localeStore";

const mockedGet = SecureStore.getItemAsync as jest.Mock;

describe("RootLayout's locale wiring", () => {
  beforeEach(() => {
    capturedLocaleProps.length = 0;
    mockedGet.mockReset();
    useLocaleStore.setState({ locale: undefined });
  });

  it("mounts with no locale, then re-renders with the saved one once it resolves", async () => {
    mockedGet.mockResolvedValue("en");

    render(<RootLayout />);

    // First render: the async read has not resolved yet, so KayaI18nProvider
    // gets undefined and falls back to its own default (French) -- exactly
    // what a cold start with no cached preference looks like too.
    expect(capturedLocaleProps[0]).toBeUndefined();

    await waitFor(() => {
      expect(capturedLocaleProps.at(-1)).toBe("en");
    });
  });

  it("stays on the default when nothing was ever saved", async () => {
    mockedGet.mockResolvedValue(null);

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalled();
    });
    expect(capturedLocaleProps.every((locale) => locale === undefined)).toBe(true);
  });
});
