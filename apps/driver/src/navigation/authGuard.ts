import type { AuthStatus } from "../state/authStore";

/**
 * Auth-aware redirect decision, ported from this app's own Dart original,
 * `legacy/flutter/driver/lib/router.dart` — not the client's, which differs.
 * Kept as a pure function, independent of expo-router, so the rules can be
 * unit tested without mounting a navigator; app/_layout.tsx wires this into
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
  // signed-in driver seeing the welcome screen for a frame.
  if (status === "unknown") {
    return loc === "/splash" ? null : "/splash";
  }

  // "/login-verify" is covered by the "/login" prefix, same as the Dart
  // original's separate (redundant) branch for it.
  //
  // "/verify-documents" belongs in this list for the driver and not for the
  // client: a driver registers, then waits on document verification, so that
  // screen has to be reachable before the account is usable.
  const onAuthFlow =
    loc.startsWith("/welcome") ||
    loc.startsWith("/login") ||
    loc.startsWith("/register") ||
    loc.startsWith("/verify-documents") ||
    loc === "/splash";

  // Rule 2: not authenticated -> only the auth routes are allowed. Splash is
  // not a place to stay once the status is known, so it redirects too.
  if (status !== "authenticated") {
    return onAuthFlow && loc !== "/splash" ? null : "/welcome";
  }

  // Rule 3: authenticated but sitting on an auth screen -> go home, except on
  // "/verify-documents". A driver whose documents are still pending is
  // authenticated and must be able to stay there; bouncing them home would
  // leave them no way to finish verifying, and so no way to work.
  if (onAuthFlow && loc !== "/verify-documents") return "/home";
  return null;
}
