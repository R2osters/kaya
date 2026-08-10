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
import { ROUTE_GROUPS } from "../src/navigation/routeIndex";

// The placeholders now render the route index, so they pull Link and
// usePathname from expo-router. Mocked here rather than pulled in for real:
// this suite is about which routes exist, not about navigation behaviour.
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Link: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
      <Text testID={testID}>{children}</Text>
    ),
    usePathname: () => "/",
  };
});


/**
 * One row per route this task builds (task 5's brief). `file` is the path
 * relative to app/, exactly as expo-router would see it; `testID` and `key`
 * are what RoutePlaceholder was given when the route file was written.
 *
 * "index.tsx" is deliberately not in this table: it is a bare `<Redirect
 * href="/splash" />` (see index.tsx and index.test.tsx), not a
 * RoutePlaceholder, so it has nothing in common with the shape asserted on
 * below. Its own behaviour is covered by index.test.tsx. "showcase.tsx" is a
 * route, but not a RoutePlaceholder either -- see showcase.test.tsx.
 */
interface RouteRow {
  file: string;
  pathname: string;
  testID: string;
  key: keyof typeof resources.fr.translation;
  /**
   * Set once a route stops being a RoutePlaceholder and becomes a real screen.
   * It still has to exist and still has to resolve to its expected pathname --
   * those two checks are what stop a route quietly disappearing -- but it no
   * longer renders the placeholder body, and it may need providers (a
   * QueryClient, a router) that this suite deliberately does not mount. Its own
   * suite covers it instead.
   */
  implemented?: true;
}

const ROUTES: RouteRow[] = [
  { file: "splash.tsx", pathname: "/splash", testID: "splash-screen", key: "screenSplash" },
  { file: "(auth)/welcome.tsx", pathname: "/welcome", testID: "welcome-screen", key: "screenWelcome" },
  {
    file: "(auth)/login.tsx",
    pathname: "/login",
    testID: "login-screen",
    key: "screenLogin",
    // Phase 2A: real screen, covered by app/(auth)/login.test.tsx.
    implemented: true,
  },
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
  { file: "(tabs)/home.tsx", pathname: "/home", testID: "home-screen", key: "screenHome" },
  { file: "(tabs)/history.tsx", pathname: "/history", testID: "history-screen", key: "screenHistory" },
  { file: "(tabs)/inbox.tsx", pathname: "/inbox", testID: "inbox-screen", key: "screenInbox" },
  { file: "(tabs)/profile.tsx", pathname: "/profile", testID: "profile-screen", key: "screenProfile" },
  {
    file: "create-order.tsx",
    pathname: "/create-order",
    testID: "create-order-screen",
    key: "screenCreateOrder",
  },
  {
    file: "address-search.tsx",
    pathname: "/address-search",
    testID: "address-search-screen",
    key: "screenAddressSearch",
    // Phase 2A: real screen, covered by app/address-search.test.tsx.
    implemented: true,
  },
  {
    file: "notifications.tsx",
    pathname: "/notifications",
    testID: "notifications-screen",
    key: "screenNotifications",
  },
  { file: "offers/[orderId].tsx", pathname: "/offers/[orderId]", testID: "offers-screen", key: "screenOffers" },
  { file: "payment/index.tsx", pathname: "/payment", testID: "payment-screen", key: "screenPayment" },
  {
    file: "payment/webview.tsx",
    pathname: "/payment/webview",
    testID: "payment-webview-screen",
    key: "screenPaymentWebview",
  },
  {
    file: "payment/receipt.tsx",
    pathname: "/payment/receipt",
    testID: "payment-receipt-screen",
    key: "screenPaymentReceipt",
  },
  {
    file: "tracking/[deliveryId].tsx",
    pathname: "/tracking/[deliveryId]",
    testID: "tracking-screen",
    key: "screenTracking",
  },
  { file: "chat/[deliveryId].tsx", pathname: "/chat/[deliveryId]", testID: "chat-screen", key: "screenChat" },
  {
    file: "rating/[deliveryId].tsx",
    pathname: "/rating/[deliveryId]",
    testID: "rating-screen",
    key: "screenRating",
  },
];

/** expo-router's own file-path -> pathname conversion (see the import above). */
function pathnameFor(file: string): string {
  const stripped = stripInvisibleSegmentsFromPath(getNameFromFilePath(file));
  return stripped === "" ? "/" : `/${stripped}`;
}

describe("client route tree (task 5)", () => {
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

  it.each(ROUTES.filter((r) => r.implemented !== true))(
    "$file renders its own translated name under testID $testID",
    ({ file, testID, key }) => {
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
    // Scoped to the title node: the route index below repeats every screen
    // name as a link, so a bare getByText would match more than one.
      expect(screen.getByTestId(`${testID}-title`)).toHaveTextContent(
        resources.fr.translation[key],
      );
      screen.unmount();
    },
  );

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

  it("covers every route named in task 5's brief plus splash, index.tsx and showcase.tsx aside", () => {
    expect(ROUTES).toHaveLength(20);
  });

  it("every href in the route explorer resolves to a real route", () => {
    // The explorer (src/navigation/routeIndex.ts) is the only way to walk the
    // shell, and a dead entry in it is invisible: expo-router does not throw
    // on a missing route, the tap simply does nothing. This caught exactly
    // that -- the design-system entry pointed at "/_showcase", and
    // expo-router does not route an underscore-prefixed file at all, so the
    // one screen the phase exists to show a human could not be opened.
    //
    // Dynamic segments are compared by shape: the explorer links concrete ids
    // ("/tracking/demo-delivery") at routes declared with a parameter
    // ("/tracking/[deliveryId]").
    const declared = ROUTES.map((r) => r.pathname).concat("/showcase");

    const matches = (href: string): boolean =>
      declared.some((pathname) => {
        const hrefParts = href.split("/");
        const routeParts = pathname.split("/");
        if (hrefParts.length !== routeParts.length) return false;
        return routeParts.every(
          (part, i) => part.startsWith("[") || part === hrefParts[i],
        );
      });

    const dead = ROUTE_GROUPS.flatMap((group) => group.routes)
      .map((route) => route.href)
      .filter((href) => !matches(href));

    expect(dead).toEqual([]);
  });

  it("the showcase is a route, so a human can open it on a device", () => {
    expect(fs.existsSync(path.join(__dirname, "showcase.tsx"))).toBe(true);
    expect(pathnameFor("showcase.tsx")).toBe("/showcase");
  });
});
