import type { AuthStatus } from "../state/authStore";

/**
 * Auth-aware redirect decision, ported exactly from
 * `legacy/flutter/client/lib/router.dart`'s `redirect`. Kept as a pure
 * function -- independent of expo-router -- so the three rules can be unit
 * tested without mounting a navigator; app/_layout.tsx wires this into
 * `usePathname`/`useRouter`.
 *
 * `loc` mirrors go_router's `state.matchedLocation`: the current path with a
 * leading slash, e.g. "/login".
 *
 * Returns the path to redirect to, or `null` to stay where the app already is.
 */
export function resolveAuthRedirect(status: AuthStatus, loc: string): string | null {
  // Rule 1: while the status is unknown (token not read from the keychain
  // yet), hold on the splash route and go nowhere else. This is what stops a
  // signed-in user seeing the welcome screen for a frame.
  if (status === "unknown") {
    return loc === "/splash" ? null : "/splash";
  }

  // "/login-verify", "/login-otp" etc. are covered by the "/login" prefix
  // check below, same as the Dart original's separate (redundant) branch for
  // "/login-verify".
  const onAuthFlow =
    loc.startsWith("/welcome") ||
    loc.startsWith("/login") ||
    loc.startsWith("/register") ||
    loc === "/splash";

  // Rule 2: not authenticated -> only the auth routes are allowed. Splash is
  // not a place to stay once the status is known, so it redirects too.
  if (status !== "authenticated") {
    return onAuthFlow && loc !== "/splash" ? null : "/welcome";
  }

  // Rule 3: authenticated but sitting on an auth screen -> go home.
  if (onAuthFlow) return "/home";
  return null;
}
