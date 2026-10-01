import { KayaI18nProvider } from "@kaya/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerAppMapProvider } from "../src/map/register";
import { resolveAuthRedirect } from "../src/navigation/authGuard";
import { usePushMessages } from "../src/push/usePushMessages";
import { usePushRegistration } from "../src/push/usePushRegistration";
import { useSocketBridge } from "../src/realtime/useSocketBridge";
import { useAuthStore } from "../src/state/authStore";
import { useLocaleStore } from "../src/state/localeStore";
import { queryClient } from "../src/state/queryClient";

// At module scope, not in an effect: a screen deeper in the tree can render a
// <MapView> in its own first commit, which happens before this layout's
// effects run. Registering there would show the stylized fallback for a frame
// and then swap it for the real map. The call is idempotent -- the registry
// holds one slot -- so a fast refresh re-running this module is harmless.
registerAppMapProvider();

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
function AuthGuard(): React.ReactElement | null {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  // Nothing rendered from the root layout may navigate on the first pass:
  // the <Stack> sibling below is what creates the navigator, and expo-router
  // throws "Attempted to navigate before mounting the Root Layout component"
  // for anything that tries earlier -- an effect calling router.replace, a
  // <Redirect>, and a useRootNavigationState gate all fail the same way.
  // Flipping this in an effect forces a second render, by which point the
  // navigator exists. The whole test suite passed against every one of those
  // broken versions, because a mocked router accepts anything.
  const [navigatorMounted, setNavigatorMounted] = useState(false);
  useEffect(() => {
    setNavigatorMounted(true);
  }, []);

  if (!navigatorMounted) return null;

  const target = resolveAuthRedirect(status, pathname);
  if (target === null) return null;

  return <Redirect href={target} />;
}

/**
 * Renders nothing; exists so the two session-scoped background jobs sit
 * *inside* `QueryClientProvider`. `useSocketBridge` calls `useQueryClient`,
 * which cannot see a provider that its own component renders -- putting these
 * hooks in `RootLayout` itself throws "No QueryClient set".
 *
 * Both are gated on the auth status internally, so this mounts unconditionally
 * and each decides for itself when there is a session to act on.
 */
function SessionServices(): null {
  useSocketBridge();
  usePushRegistration();
  // Registration only tells the backend where to send them; this is what
  // listens. Without it a push arriving while the app is open does nothing,
  // and a tap opens the app on whatever screen it was left on.
  usePushMessages();
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
    // Outermost, and it has to be: react-native-gesture-handler routes touches
    // through a native root view, and a gesture mounted outside one silently
    // never fires on Android. The driver's home sheet is the first thing in
    // either app to use a raw gesture -- navigation supplies its own root for
    // its own gestures, which is why nothing needed this until now.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KayaI18nProvider locale={locale}>
          {/* Order matters. React runs effects child-first and, among
              siblings, in render order -- so AuthGuard rendered before
              <Stack> fires its redirect while the navigator does not exist
              yet, and expo-router throws "Attempted to navigate before
              mounting the Root Layout component". Rendering it after <Stack>
              is what guarantees the navigator has mounted first. AuthGuard's
              own deferral is the second half of the fix; neither half was
              enough on its own on a real device. */}
          {/* Declared rather than inherited, same as the client's stack: with
              only `headerShown` set, a pushed screen used whatever the
              platform defaulted to, so the two apps and the two platforms
              disagreed about what "going deeper" looks like. */}
            <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
            <AuthGuard />
            <SessionServices />
          </KayaI18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
