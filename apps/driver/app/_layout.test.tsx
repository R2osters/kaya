import { render } from "@testing-library/react-native";
import RootLayout from "./_layout";

// Mutable per-test fixtures. Safe to close over from the jest.mock factories
// below because both mocked hooks are only invoked during React render/effect
// phases (well after this module has finished loading) -- unlike
// src/state/authStore.ts's module-level `setOnSessionExpired(...)` call,
// nothing here runs at import time.
let mockStatus: "unknown" | "authenticated" | "anonymous" = "unknown";
let mockPathname = "/splash";
const mockReplace = jest.fn();
const mockRestoreSession = jest.fn();
const mockLoadSavedLocale = jest.fn();

jest.mock("expo-router", () => ({
  Stack: () => null,
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
  usePathname: () => mockPathname,
}));

// authGuard.ts itself is left unmocked -- its three rules already have
// dedicated coverage in src/navigation/authGuard.test.ts, and running the
// real function here proves _layout.tsx is actually wired to it, not just
// wired to some redirect function.
jest.mock("../src/state/authStore", () => {
  const useAuthStore = (selector: (state: { status: string; user: null }) => unknown) =>
    selector({ status: mockStatus, user: null });
  Object.assign(useAuthStore, {
    getState: () => ({ status: mockStatus, user: null, restoreSession: mockRestoreSession }),
  });
  return { useAuthStore };
});

// The async-read-then-controlled-prop path this store feeds KayaI18nProvider
// has its own dedicated coverage in _layout.locale.test.tsx, with a real
// (unmocked) localeStore -- mocked wholesale here since this file's guard
// tests have nothing to do with locale.
jest.mock("../src/state/localeStore", () => {
  const useLocaleStore = (selector: (state: { locale: undefined }) => unknown) =>
    selector({ locale: undefined });
  Object.assign(useLocaleStore, {
    getState: () => ({ locale: undefined, loadSavedLocale: mockLoadSavedLocale, setLocale: jest.fn() }),
  });
  return { useLocaleStore };
});

describe("RootLayout's auth guard", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockRestoreSession.mockClear();
    mockLoadSavedLocale.mockClear();
  });

  it("restores the session exactly once, on mount", () => {
    mockStatus = "unknown";
    mockPathname = "/splash";

    render(<RootLayout />);

    expect(mockRestoreSession).toHaveBeenCalledTimes(1);
  });

  it("restores the saved locale exactly once, on mount", () => {
    mockStatus = "unknown";
    mockPathname = "/splash";

    render(<RootLayout />);

    expect(mockLoadSavedLocale).toHaveBeenCalledTimes(1);
  });

  it("rule 1: holds an unknown status on splash without redirecting", () => {
    mockStatus = "unknown";
    mockPathname = "/splash";

    render(<RootLayout />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("rule 1: redirects to splash from any other route while the status is unknown", () => {
    mockStatus = "unknown";
    mockPathname = "/home";

    render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith("/splash");
  });

  it("rule 2: redirects an anonymous session off a protected route to /welcome", () => {
    mockStatus = "anonymous";
    mockPathname = "/home";

    render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith("/welcome");
  });

  it("rule 2: leaves an anonymous session alone on an auth route", () => {
    mockStatus = "anonymous";
    mockPathname = "/login";

    render(<RootLayout />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("rule 3: redirects an authenticated session off an auth route to /home", () => {
    mockStatus = "authenticated";
    mockPathname = "/login";

    render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("rule 3: leaves an authenticated session alone on a protected route", () => {
    mockStatus = "authenticated";
    mockPathname = "/home";

    render(<RootLayout />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
