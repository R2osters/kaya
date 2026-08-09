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
  routes: { href: string; titleKey: string }[];
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
      { href: "/verify-documents", titleKey: "screenVerifyDocuments" },
    ],
  },
  {
    titleKey: "navGroupMain",
    routes: [
      { href: "/home", titleKey: "screenHome" },
      { href: "/earnings", titleKey: "screenEarnings" },
      { href: "/inbox", titleKey: "screenInbox" },
      { href: "/profile", titleKey: "screenProfile" },
    ],
  },
  {
    titleKey: "navGroupDriverWork",
    routes: [
      { href: "/propose/demo-order", titleKey: "screenPropose" },
      { href: "/delivery/demo-delivery", titleKey: "screenDelivery" },
      { href: "/delivery-detail/demo-delivery", titleKey: "screenDeliveryDetail" },
      { href: "/chat/demo-delivery", titleKey: "screenChat" },
      { href: "/rating/demo-delivery", titleKey: "screenRating" },
    ],
  },
  {
    titleKey: "navGroupDriverMoney",
    routes: [
      { href: "/withdraw", titleKey: "screenWithdraw" },
      { href: "/stats", titleKey: "screenStats" },
      { href: "/history", titleKey: "screenHistory" },
      { href: "/notifications", titleKey: "screenNotifications" },
    ],
  },
  {
    titleKey: "navGroupDesignSystem",
    routes: [{ href: "/showcase", titleKey: "screenShowcase" }],
  },
];
