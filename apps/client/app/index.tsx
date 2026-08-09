import { Redirect } from "expo-router";

/**
 * The router's entry point -- Expo Router always resolves a fresh launch to
 * "/", so something has to live here. Redirects straight to "/splash", the
 * real splash placeholder (see splash.tsx), which is also the path
 * AuthGuard's rule 1 checks for in app/_layout.tsx and legacy/flutter/client/
 * lib/router.dart's `redirect` before it: the Dart original's go_router had
 * no "/" route at all, and set `initialLocation: '/splash'` directly.
 * Expo Router has no equivalent of `initialLocation` -- this file is what
 * bridges the gap, so "/" is never a place the auth guard has to know about.
 */
export default function IndexRoute() {
  return <Redirect href="/splash" />;
}
