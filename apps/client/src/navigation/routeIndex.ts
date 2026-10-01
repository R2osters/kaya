import type { Href } from "expo-router";

/**
 * Every route this app declares, grouped for the shell's route explorer.
 *
 * Phase 1C ships placeholders, not screens — which left the app impossible to
 * walk: nothing on a placeholder was tappable, so the only way to reach any of
 * the 46 routes was an adb deep link. A shell nobody can navigate cannot be
 * reviewed, so each placeholder renders this list and lets you jump anywhere.
 *
 * The real screens replace the placeholders in phases 2 and 3; this index goes
 * with them.
 */
export interface RouteGroup {
  /** i18n key for the group heading. */
  titleKey: string;
  // Checked against the generated route tree, not a bare string: this index is
  // a hand-maintained list of routes, exactly the kind that rots silently.
  // Typed this way, a route deleted or renamed breaks the build here instead
  // of leaving a dead entry in the explorer.
  //
  // The string arm of `Href` rather than `Href` itself: these values are also
  // used as React keys and compared against `usePathname()`, neither of which
  // accepts the `{ pathname, params }` form, and a static index has no use for
  // it anyway.
  routes: { href: Extract<Href, string>; titleKey: string }[];
}

export const ROUTE_GROUPS: RouteGroup[] = [
  {
    titleKey: "navGroupAuth",
    routes: [
      { href: "/splash", titleKey: "screenSplash" },
      { href: "/welcome", titleKey: "screenWelcome" },
      { href: "/login", titleKey: "screenLogin" },
      { href: "/login-verify", titleKey: "screenLoginVerify" },
      { href: "/register", titleKey: "screenRegister" },
      { href: "/password-reset", titleKey: "screenPasswordReset" },
    ],
  },
  {
    titleKey: "navGroupMain",
    routes: [
      { href: "/home", titleKey: "screenHome" },
      { href: "/history", titleKey: "screenHistory" },
      { href: "/inbox", titleKey: "screenInbox" },
      { href: "/profile", titleKey: "screenProfile" },
    ],
  },
  {
    titleKey: "navGroupOrder",
    routes: [
      { href: "/create-order", titleKey: "screenCreateOrder" },
      { href: "/address-search", titleKey: "screenAddressSearch" },
      { href: "/offers/demo-order", titleKey: "screenOffers" },
      { href: "/tracking/demo-delivery", titleKey: "screenTracking" },
      { href: "/chat/demo-delivery", titleKey: "screenChat" },
      { href: "/rating/demo-delivery", titleKey: "screenRating" },
    ],
  },
  {
    titleKey: "navGroupPayment",
    routes: [
      { href: "/payment?deliveryId=demo-delivery&amount=25&currency=GHS", titleKey: "screenPayment" },
      { href: "/payment/receipt?deliveryId=demo-delivery", titleKey: "screenPaymentReceipt" },
      { href: "/notifications", titleKey: "screenNotifications" },
    ],
  },
  {
    titleKey: "navGroupDesignSystem",
    routes: [{ href: "/showcase", titleKey: "screenShowcase" }],
  },
];
