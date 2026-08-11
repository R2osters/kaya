import { useRouter } from "expo-router";

/**
 * A way back, or nothing when there is nowhere to go.
 *
 * Screens hand the result straight to `KayaScreenHeader.onBack`, which renders
 * its chevron only when it gets one. That is the whole point: most screens are
 * pushed and should offer a way out, but a few are landed on directly -- a
 * push notification's deep link, a `replace` after registration, a cold start
 * on a route -- and there is nothing behind them. A chevron that pops nothing
 * is worse than no chevron: it is a control that visibly does not work.
 *
 * `canGoBack()` is read on every render rather than once, because the same
 * screen can be either: reached by a push it has history behind it, reached by
 * a deep link it does not.
 *
 * Anything unusable about the router -- the method missing, or it throwing
 * because there is no mounted navigator yet -- degrades to "no way back". This
 * hook runs on nearly every screen in the app, and the alternative is a
 * decoration taking the whole screen down.
 */
export function useGoBack(): (() => void) | undefined {
  const router = useRouter();

  let canGoBack = false;
  try {
    canGoBack = typeof router.canGoBack === "function" && router.canGoBack();
  } catch {
    canGoBack = false;
  }

  return canGoBack ? () => router.back() : undefined;
}
