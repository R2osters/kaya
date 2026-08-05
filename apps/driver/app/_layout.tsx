import { KayaI18nProvider } from "@kaya/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { resolveAuthRedirect } from "../src/navigation/authGuard";
import { useAuthStore } from "../src/state/authStore";
import { useLocaleStore } from "../src/state/localeStore";
import { queryClient } from "../src/state/queryClient";

/**
 * Reads the session once, on mount. `useAuthStore.getState()` rather than the
 * hook: this must run exactly once regardless of how many times RootLayout
 * re-renders, same as the Dart original's `AuthController` bootstrapping
 * itself from its constructor.
 */
function useSessionRestoration(): void {
  useEffect(() => {
    void useAuthStore.getState().restoreSession();
  }, []);
}

/**
 * Reads the saved language preference once, on mount, the same way
 * useSessionRestoration reads the session: through `getState()` rather than
 * the hook, so it runs exactly once regardless of re-renders. The store's
 * `locale` starts undefined and only ever changes once this resolves (or
 * stays undefined if nothing was saved) -- see src/state/localeStore.ts.
 */
function useLocaleRestoration(): void {
  useEffect(() => {
    void useLocaleStore.getState().loadSavedLocale();
  }, []);
}

/**
 * Auth-aware route guard. Subscribes to the store's `status` so it re-runs
 * whenever restoreSession() settles or the session-expiry handler flips the
 * status, and to the current path so it re-runs on every navigation -- the
 * same two triggers the Dart original's go_router `redirect` responded to
 * (state change via `refreshListenable`, navigation via `state.matchedLocation`).
 * See src/navigation/authGuard.ts for the three rules themselves.
 */
function AuthGuard(): null {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const target = resolveAuthRedirect(status, pathname);
    if (target !== null) {
      router.replace(target);
    }
  }, [status, pathname, router]);

  return null;
}

/**
 * Root layout. Provider stack, outside in:
 *
 * - `SafeAreaProvider` (react-native-safe-area-context) so any screen or
 *   @kaya/ui component (e.g. BottomSheetShell, since this task) can read
 *   real device insets instead of a hardcoded fallback.
 * - `QueryClientProvider`, wired to the singleton built in
 *   src/state/queryClient.ts: retry policy for queries (network/timeout
 *   only, with backoff), no retry at all for mutations (the money-safety
 *   rule -- see that module), and the unauthorized-clears-session handler
 *   that backs AuthGuard's redirect.
 * - `KayaI18nProvider`, given the store's `locale` as a controlled prop --
 *   `useLocaleRestoration` resolves it asynchronously from the saved
 *   preference (or leaves it undefined, the provider's own default), which
 *   is exactly the controlled-prop-changes-after-mount path phase 1B's
 *   KayaI18nProvider fix targets (see @kaya/ui's adapters/KayaI18nProvider.tsx).
 *
 * The route tree itself (splash/welcome/home/...) is built out in task 5 --
 * until then AuthGuard's redirects target paths that do not exist yet, same
 * as they would on any app whose routes are still being built.
 */
export default function RootLayout() {
  useSessionRestoration();
  useLocaleRestoration();
  const locale = useLocaleStore((s) => s.locale);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <KayaI18nProvider locale={locale}>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </KayaI18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
