import { resolveAuthRedirect } from "./authGuard";

/**
 * Exercises the three rules ported from
 * `legacy/flutter/client/lib/router.dart`'s `redirect`, verbatim -- see that
 * file's comments for why each rule exists.
 *
 * `legacy/flutter/driver/lib/router.dart` carries one extra wrinkle on top of
 * these three rules: an authenticated driver on `/verify-documents` is not
 * bounced to `/home` the way other auth routes are. The phase 1C task 3 brief
 * names the client's router.dart as the exact source to port for both apps
 * and lists only the three rules below, and `/verify-documents` does not
 * exist as a route yet (the route tree is task 5), so that carve-out is
 * intentionally not reproduced here -- see task-1c-3-report.md.
 */
describe("resolveAuthRedirect", () => {
  describe("rule 1: status unknown holds on splash", () => {
    it("stays on splash while the status is unknown", () => {
      expect(resolveAuthRedirect("unknown", "/splash")).toBeNull();
    });

    it("redirects to splash from anywhere else while unknown, so a signed-in driver never sees the welcome screen for a frame", () => {
      expect(resolveAuthRedirect("unknown", "/welcome")).toBe("/splash");
      expect(resolveAuthRedirect("unknown", "/home")).toBe("/splash");
      expect(resolveAuthRedirect("unknown", "/login")).toBe("/splash");
    });
  });

  describe("rule 2: unauthenticated is confined to the auth routes", () => {
    it("allows the welcome, login, login-verify and register routes", () => {
      expect(resolveAuthRedirect("anonymous", "/welcome")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/login")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/login-verify")).toBeNull();
      expect(resolveAuthRedirect("anonymous", "/register")).toBeNull();
    });

    it("redirects anything outside the auth flow to /welcome", () => {
      expect(resolveAuthRedirect("anonymous", "/home")).toBe("/welcome");
      expect(resolveAuthRedirect("anonymous", "/profile")).toBe("/welcome");
      expect(resolveAuthRedirect("anonymous", "/deliveries")).toBe("/welcome");
    });

    it("does not leave an unauthenticated driver parked on splash once the status is known", () => {
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
      expect(resolveAuthRedirect("authenticated", "/deliveries")).toBeNull();
    });

    it("leaves an authenticated driver on /verify-documents", () => {
      // The driver's own Dart guard carves this out of rule 3. A driver whose
      // documents are still pending is authenticated: bouncing them to /home
      // would leave them no way to finish verifying, and so no way to work.
      expect(resolveAuthRedirect("authenticated", "/verify-documents")).toBeNull();
    });
  });

  describe("/verify-documents, which the client app has no equivalent of", () => {
    it("is reachable before signing in", () => {
      expect(resolveAuthRedirect("anonymous", "/verify-documents")).toBeNull();
    });

    it("still yields to the unknown-status hold", () => {
      // Rule 1 outranks everything: nothing renders until the keychain read
      // has settled, or a signed-in driver flashes the welcome screen.
      expect(resolveAuthRedirect("unknown", "/verify-documents")).toBe("/splash");
    });
  });
});
