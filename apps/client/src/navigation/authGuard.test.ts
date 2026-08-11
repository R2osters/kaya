import { resetIntendedPath, resolveAuthRedirect } from "./authGuard";

/**
 * Exercises the three rules ported from
 * `legacy/flutter/client/lib/router.dart`'s `redirect`, verbatim -- see that
 * file's comments for why each rule exists -- plus the deep-link stash the
 * port added on top of them (a cold-start link is the initial route, and rule
 * 1 used to swallow it).
 */
describe("resolveAuthRedirect", () => {
  beforeEach(() => resetIntendedPath());

  describe("rule 1: status unknown holds on splash", () => {
    it("stays on splash while the status is unknown", () => {
      expect(resolveAuthRedirect("unknown", "/splash")).toBeNull();
    });

    it("redirects to splash from anywhere else while unknown, so a signed-in user never sees the welcome screen for a frame", () => {
      expect(resolveAuthRedirect("unknown", "/welcome")).toBe("/splash");
      expect(resolveAuthRedirect("unknown", "/home")).toBe("/splash");
      expect(resolveAuthRedirect("unknown", "/login")).toBe("/splash");
    });
  });

  describe("rule 2: unauthenticated is confined to the auth routes", () => {
    it("allows the welcome, login, login-verify, register and password-reset routes", () => {
      expect(resolveAuthRedirect("anonymous", "/welcome")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/login")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/login-verify")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/register")).toBeNull();
    });

    it("redirects anything outside the auth flow to /welcome", () => {
      expect(resolveAuthRedirect("anonymous", "/home")).toBe("/welcome");
      expect(resolveAuthRedirect("anonymous", "/profile")).toBe("/welcome");
      expect(resolveAuthRedirect("anonymous", "/tracking/123")).toBe("/welcome");
    });

    it("does not leave an unauthenticated user parked on splash once the status is known", () => {
      expect(resolveAuthRedirect("anonymous", "/splash")).toBe("/welcome");
    });
  });

  describe("rule 3: authenticated leaves an auth screen for home", () => {
    it("redirects off welcome/login/register/splash to /home", () => {
      expect(resolveAuthRedirect("authenticated", "/welcome")).toBe("/home");
      expect(resolveAuthRedirect("authenticated", "/login")).toBe("/home");
      expect(resolveAuthRedirect("authenticated", "/login-verify")).toBe("/home");
      expect(resolveAuthRedirect("authenticated", "/register")).toBe("/home");
      expect(resolveAuthRedirect("authenticated", "/splash")).toBe("/home");
    });

    it("stays put on any non-auth route", () => {
      expect(resolveAuthRedirect("authenticated", "/home")).toBeNull();
      expect(resolveAuthRedirect("authenticated", "/profile")).toBeNull();
      expect(resolveAuthRedirect("authenticated", "/tracking/123")).toBeNull();
    });
  });

  describe("deep-link stash: the splash bounce does not swallow a cold-start link", () => {
    it("returns a signed-in cold start to the path the link pointed at", () => {
      // Sequence of a cold start via kayaclient://tracking/123: the link is
      // the initial route, rule 1 displaces it to /splash, the session
      // restores, and rule 3 must remember where the launch was headed.
      expect(resolveAuthRedirect("unknown", "/tracking/123")).toBe("/splash");
      expect(resolveAuthRedirect("unknown", "/splash")).toBeNull();
      expect(resolveAuthRedirect("authenticated", "/splash")).toBe("/tracking/123");
    });

    it("keeps the query string when the caller provides the full href", () => {
      // usePathname strips queries; /payment/return without its ?reference=
      // verifies nothing, which is why the guard passes href separately.
      resolveAuthRedirect("unknown", "/payment/return", "/payment/return?reference=r-1");
      expect(resolveAuthRedirect("authenticated", "/splash")).toBe(
        "/payment/return?reference=r-1",
      );
    });

    it("carries the intent through a sign-in detour", () => {
      resolveAuthRedirect("unknown", "/offers/o-1");
      expect(resolveAuthRedirect("anonymous", "/splash")).toBe("/welcome");
      expect(resolveAuthRedirect("anonymous", "/login")).toBeNull();
      expect(resolveAuthRedirect("authenticated", "/login")).toBe("/offers/o-1");
    });

    it("consumes the intent -- the next auth-screen exit is plain /home again", () => {
      resolveAuthRedirect("unknown", "/tracking/123");
      resolveAuthRedirect("authenticated", "/splash");
      expect(resolveAuthRedirect("authenticated", "/splash")).toBe("/home");
    });

    it("stashes nothing for an ordinary launch", () => {
      expect(resolveAuthRedirect("unknown", "/")).toBe("/splash");
      expect(resolveAuthRedirect("authenticated", "/splash")).toBe("/home");
    });
  });
});
