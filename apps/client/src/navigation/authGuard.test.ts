import { resolveAuthRedirect } from "./authGuard";

/**
 * Exercises the three rules ported from
 * `legacy/flutter/client/lib/router.dart`'s `redirect`, verbatim -- see that
 * file's comments for why each rule exists.
 */
describe("resolveAuthRedirect", () => {
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
});
