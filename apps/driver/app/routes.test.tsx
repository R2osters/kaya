import fs from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react-native";
import { KayaI18nProvider } from "@kaya/ui";
import { resources } from "@kaya/core";
// Deep import, deliberately: this is expo-router's own file-path-to-pathname
// conversion (group stripping, trailing "/index" stripping), the same logic
// its testing-library and runtime router both build on. Reusing it here
// means "does this file resolve to the right URL" is checked against the
// framework's real rules, not a hand-rolled reimplementation of them that
// could quietly drift from what Expo Router itself does.
// (the app-layer no-restricted-imports rule only forbids deep imports into
// @kaya/core and @kaya/ui, so expo-router's own internals are unaffected.)
import { getNameFromFilePath, stripInvisibleSegmentsFromPath } from "expo-router/build/matchers";

/**
 * One row per route this task builds (task 5's brief). `file` is the path
 * relative to app/, exactly as expo-router would see it; `testID` and `key`
 * are what RoutePlaceholder was given when the route file was written.
 *
 * "index.tsx" is deliberately not in this table: it is a bare `<Redirect
 * href="/splash" />` (see index.tsx and index.test.tsx), not a
 * RoutePlaceholder, so it has nothing in common with the shape asserted on
 * below. Its own behaviour is covered by index.test.tsx. "_showcase.tsx" is
 * not a route at all -- see _showcase.test.tsx.
 */
interface RouteRow {
  file: string;
  pathname: string;
  testID: string;
  key: keyof typeof resources.fr.translation;
}

const ROUTES: RouteRow[] = [
  { file: "splash.tsx", pathname: "/splash", testID: "splash-screen", key: "screenSplash" },
  { file: "(auth)/welcome.tsx", pathname: "/welcome", testID: "welcome-screen", key: "screenWelcome" },
  { file: "(auth)/login.tsx", pathname: "/login", testID: "login-screen", key: "screenLogin" },
  {
    file: "(auth)/login-verify.tsx",
    pathname: "/login-verify",
    testID: "login-verify-screen",
    key: "screenLoginVerify",
  },
  { file: "(auth)/register.tsx", pathname: "/register", testID: "register-screen", key: "screenRegister" },
  {
    file: "(auth)/password-reset.tsx",
    pathname: "/password-reset",
    testID: "password-reset-screen",
    key: "screenPasswordReset",
  },
  {
    file: "verify-documents.tsx",
    pathname: "/verify-documents",
    testID: "verify-documents-screen",
    key: "screenVerifyDocuments",
  },
  { file: "(tabs)/home.tsx", pathname: "/home", testID: "home-screen", key: "screenHome" },
  { file: "(tabs)/earnings.tsx", pathname: "/earnings", testID: "earnings-screen", key: "screenEarnings" },
  { file: "(tabs)/inbox.tsx", pathname: "/inbox", testID: "inbox-screen", key: "screenInbox" },
  { file: "(tabs)/profile.tsx", pathname: "/profile", testID: "profile-screen", key: "screenProfile" },
  { file: "propose/[orderId].tsx", pathname: "/propose/[orderId]", testID: "propose-screen", key: "screenPropose" },
  {
    file: "delivery/[deliveryId].tsx",
    pathname: "/delivery/[deliveryId]",
    testID: "delivery-screen",
    key: "screenDelivery",
  },
  {
    file: "delivery-detail/[deliveryId].tsx",
    pathname: "/delivery-detail/[deliveryId]",
    testID: "delivery-detail-screen",
    key: "screenDeliveryDetail",
  },
  { file: "stats.tsx", pathname: "/stats", testID: "stats-screen", key: "screenStats" },
  { file: "history.tsx", pathname: "/history", testID: "history-screen", key: "screenHistory" },
  { file: "withdraw.tsx", pathname: "/withdraw", testID: "withdraw-screen", key: "screenWithdraw" },
  { file: "chat/[deliveryId].tsx", pathname: "/chat/[deliveryId]", testID: "chat-screen", key: "screenChat" },
  {
    file: "rating/[deliveryId].tsx",
    pathname: "/rating/[deliveryId]",
    testID: "rating-screen",
    key: "screenRating",
  },
  {
    file: "notifications.tsx",
    pathname: "/notifications",
    testID: "notifications-screen",
    key: "screenNotifications",
  },
];

/** expo-router's own file-path -> pathname conversion (see the import above). */
function pathnameFor(file: string): string {
  const stripped = stripInvisibleSegmentsFromPath(getNameFromFilePath(file));
  return stripped === "" ? "/" : `/${stripped}`;
}

describe("driver route tree (task 5)", () => {
  it.each(ROUTES)("$file exists on disk", ({ file }) => {
    expect(fs.existsSync(path.join(__dirname, file))).toBe(true);
  });

  it.each(ROUTES)("$file resolves to the expected pathname $pathname", ({ file, pathname }) => {
    // Proves expo-router's own group/index-stripping rules -- not a
    // hand-rolled guess at them -- put this file at this URL. A route
    // nested one folder too deep, or missing its group parens, fails here
    // instead of only 404ing the first time someone navigates to it.
    expect(pathnameFor(file)).toBe(pathname);
  });

  it.each(ROUTES)("$file renders its own translated name under testID $testID", ({ file, testID, key }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a
    // dynamic require, one per table row (see .eslintrc.cjs's override for
    // app/**/*.test.tsx), so a single missing/broken route file fails only
    // its own row instead of a static import at the top of this file
    // aborting the whole suite before any assertion runs. Dynamic `import()`
    // was tried first and rejected: Jest's CJS transform needs
    // --experimental-vm-modules to support it at all.
    const Screen = require(`./${file}`).default as ComponentType;

    render(
      <KayaI18nProvider>
        <Screen />
      </KayaI18nProvider>,
    );

    expect(screen.getByTestId(testID)).toBeTruthy();
    expect(screen.getByText(resources.fr.translation[key])).toBeTruthy();
    screen.unmount();
  });

  it("the three paths AuthGuard can redirect to all exist among these routes", () => {
    // app/_layout.tsx's AuthGuard (src/navigation/authGuard.ts) targets
    // "/splash", "/welcome" and "/home" -- a redirect to a path with no
    // matching route strands the user. This is the exact concern task 5's
    // brief calls out explicitly.
    const pathnames = new Set(ROUTES.map((r) => r.pathname));
    expect(pathnames.has("/splash")).toBe(true);
    expect(pathnames.has("/welcome")).toBe(true);
    expect(pathnames.has("/home")).toBe(true);
  });

  it("also carries /verify-documents, the route the driver's guard uniquely carves out of rule 3", () => {
    // See src/navigation/authGuard.ts: an authenticated driver sitting on
    // this route is deliberately NOT bounced to /home, so a pending-document
    // driver always has a way to finish verifying. That carve-out is only
    // meaningful if the route it points at actually exists.
    const pathnames = new Set(ROUTES.map((r) => r.pathname));
    expect(pathnames.has("/verify-documents")).toBe(true);
  });

  it("covers every route named in task 5's brief plus splash, index.tsx and _showcase.tsx aside", () => {
    expect(ROUTES).toHaveLength(20);
  });
});
