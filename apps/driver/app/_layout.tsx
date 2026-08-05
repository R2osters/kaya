import { KayaI18nProvider } from "@kaya/ui";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { resolveAuthRedirect } from "../src/navigation/authGuard";
import { useAuthStore } from "../src/state/authStore";

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
 * Root layout. KayaI18nProvider wraps the whole route tree so every screen
 * can call useTranslation() -- see @kaya/ui's adapters/KayaI18nProvider.
 * The provider stack (query client, safe-area) grows in later phase 1C
 * tasks; this task adds session restoration and the auth-aware redirect
 * (ported from legacy/flutter/client/lib/router.dart). The route tree itself
 * (splash/welcome/home/...) is built out in task 5 -- until then AuthGuard's
 * redirects target paths that do not exist yet, same as they would on any
 * app whose routes are still being built.
 */
export default function RootLayout() {
  useSessionRestoration();

  return (
    <KayaI18nProvider>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </KayaI18nProvider>
  );
}
