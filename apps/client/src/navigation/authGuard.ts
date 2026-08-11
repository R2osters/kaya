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
/**
 * The path a cold start arrived on, held across the splash bounce.
 *
 * A deep link opened while the app is closed *is* the initial route -- and
 * rule 1 immediately replaces it with /splash while the keychain is read, so
 * without this stash the link was simply swallowed: rule 3 then landed on
 * /home as if the user had launched the app by hand. (Warm links were fine;
 * this was found by paying on the emulator, where the gateway's redirect
 * relaunches the app.) Module scope, not navigation state: it must survive
 * the guard re-rendering but not an app restart.
 */
let intendedPath: string | null = null;

/** Test seam; a stale intent from one test polluting the next is a heisenbug. */
export function resetIntendedPath(): void {
  intendedPath = null;
}

export function resolveAuthRedirect(
  status: AuthStatus,
  loc: string,
  /**
   * The full location including query string, when the caller has it.
   * `usePathname()` strips queries, and a stashed /payment/return without its
   * ?reference= would verify nothing.
   */
  href?: string,
): string | null {
  // "/login-verify", "/login-otp" etc. are covered by the "/login" prefix
  // check below, same as the Dart original's separate (redundant) branch for
  // "/login-verify".
  const onAuthFlow =
    loc.startsWith("/welcome") ||
    loc.startsWith("/register") ||
    loc.startsWith("/login") ||
    loc === "/splash";

  // Rule 1: while the status is unknown (token not read from the keychain
  // yet), hold on the splash route and go nowhere else. This is what stops a
  // signed-in user seeing the welcome screen for a frame. A content path
  // being displaced is remembered -- it is where the user was headed.
  if (status === "unknown") {
    if (!onAuthFlow && loc !== "/") {
      intendedPath = href ?? loc;
    }
    return loc === "/splash" ? null : "/splash";
  }

  // Rule 2: not authenticated -> only the auth routes are allowed. Splash is
  // not a place to stay once the status is known, so it redirects too. The
  // intent survives the detour: sign in, then land where the link pointed.
  if (status !== "authenticated") {
    if (!onAuthFlow) {
      intendedPath = href ?? loc;
    }
    return onAuthFlow && loc !== "/splash" ? null : "/welcome";
  }

  // Rule 3: authenticated but sitting on an auth screen -> go where the
  // launch was headed, which failing a deep link is home.
  if (onAuthFlow) {
    const target = intendedPath ?? "/home";
    intendedPath = null;
    return target;
  }
  return null;
}
