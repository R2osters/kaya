import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

/** What came back from the gateway round trip, before the backend is asked. */
export type GatewayReturn = "returned" | "dismissed";

/**
 * Opens the gateway's checkout page and resolves when the user comes back.
 *
 * **This is deliberately not the in-app WebView the Dart original used**, and
 * the reason is what happens on that page: the user types a mobile-money PIN
 * or a card number. A system tab shows the real URL and its TLS state and is
 * out of reach of the app hosting it; an in-app WebView shows neither, can be
 * instrumented by the app, and teaches people that a chromeless page asking
 * for payment credentials is normal.
 *
 * The completion signal is better too. `openAuthSessionAsync` resolves when
 * the gateway redirects to this app's own scheme, which is a contract; the
 * Dart screen intercepted navigations and matched `url.contains('/payments/verify')`,
 * which breaks the day a gateway changes its callback path.
 *
 * What this does *not* do is decide whether the payment succeeded. Only the
 * backend knows that, and only after the gateway's webhook has landed -- which
 * may be before the user returns, after it, or minutes later on a slow
 * mobile-money confirmation. So this reports only whether the user came back
 * through the redirect or dismissed the tab, and the caller then asks the
 * backend.
 */
/**
 * The deep link the gateway sends the user back to. Built from the app's own
 * scheme (kayaclient://) so it cannot drift from app.config.ts. Exported
 * because it is part of the initialize request too: the backend forwards it to
 * the gateway so the hosted page knows where "done" leads.
 */
export function paymentReturnUrl(deliveryId?: string): string {
  // The deliveryId rides in the callback so the return route knows which
  // delivery it is finishing; the gateway appends the payment reference
  // itself. openAuthSessionAsync matches the bare path as a prefix, so the
  // query parameters do not break the session's resolution.
  return Linking.createURL(
    "payment/return",
    deliveryId === undefined ? undefined : { queryParams: { deliveryId } },
  );
}

export async function openPaymentGateway(authorizationUrl: string): Promise<GatewayReturn> {
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, paymentReturnUrl());

  // "success" means the redirect fired. Anything else -- the user pressed
  // back, swiped the tab away, or the OS closed it -- is a dismissal, and is
  // an ordinary outcome rather than an error: a payment the user abandoned is
  // a payment that did not happen, not a fault to report.
  return result.type === "success" ? "returned" : "dismissed";
}
