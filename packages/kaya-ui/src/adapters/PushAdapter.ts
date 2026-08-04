import type { PushMessage, PushProvider } from "@kaya/core";
import { toPushMessage } from "@kaya/core";
import type * as MessagingModule from "@react-native-firebase/messaging";
import type { RemoteMessage } from "@react-native-firebase/messaging";

// @react-native-firebase/messaging registers a native event emitter as a
// side effect of merely being required (see @react-native-firebase/app's
// RNFBNativeEventEmitter internals), which throws immediately if the native
// module isn't linked. That is true under Jest (no native bridge at all) and
// true in an Expo Go session (see this file's Expo Go note below) — so a
// top-level `import` here would make every consumer of @kaya/ui's barrel
// pay that cost the instant they import anything from it, not just code
// that actually touches push. expo-location/expo-image-picker don't have
// this problem (jest-expo mocks them and they degrade gracefully with no
// native binding present), so LocationAdapter/ImageAdapter import normally;
// this module is required lazily, on first use, instead.
declare function require(id: string): unknown;

let cachedMessaging: typeof MessagingModule | null = null;
function messaging(): typeof MessagingModule {
  cachedMessaging ??= require("@react-native-firebase/messaging") as typeof MessagingModule;
  return cachedMessaging;
}

// The package exports AuthorizationStatus only as a value (the statics
// object below), not as a named type, so the return type of
// requestPermission()/hasPermission() is derived from it here instead of
// imported.
type AuthorizationStatusValue = (typeof MessagingModule.AuthorizationStatus)[keyof typeof MessagingModule.AuthorizationStatus];

function isAuthorized(status: AuthorizationStatusValue): boolean {
  const { AuthorizationStatus } = messaging();
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

/**
 * Reduces a RemoteMessage to the primitives @kaya/core's toPushMessage()
 * expects. FCM data payloads are documented (both by backend's own
 * stringifyData and Firebase's web-SDK-aligned typing) to be string-valued,
 * but the type technically allows `object`, so a non-string value is
 * stringified defensively rather than silently coerced to "[object Object]"
 * by a naive template cast.
 */
function toPrimitives(message: RemoteMessage): { title: string | null; body: string | null; data: Record<string, string> } {
  const rawData = message.data ?? {};
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawData)) {
    data[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return {
    title: message.notification?.title ?? null,
    body: message.notification?.body ?? null,
    data,
  };
}

/**
 * Platform-backed PushProvider on @react-native-firebase/messaging. This is
 * the concrete half of the PushProvider interface @kaya/core declares — see
 * packages/kaya-core/src/platform/push.ts.
 *
 * Uses the modular messaging API (getMessaging/getToken/onMessage/...) —
 * the version installed here (26.x) ships only that surface; there is no
 * `messaging()` namespaced default export to fall back to.
 *
 * requestPermission()/getToken() rely on messaging's own
 * requestPermission()/hasPermission(), which the library deprecates in
 * favor of expo-notifications or react-native-permissions (removal planned
 * for a future major). Recorded here, not solved: swapping the permission
 * check to one of those without changing this class's public shape is a
 * follow-up, not something this task needs to decide.
 *
 * Does not run under Expo Go — @react-native-firebase/messaging requires a
 * config-plugin-built development build. Phase 1C (the Expo app shells) has
 * to account for that when it wires this adapter in.
 */
export class PushAdapter implements PushProvider {
  async requestPermission(): Promise<"granted" | "denied"> {
    const { getMessaging, requestPermission } = messaging();
    const status = await requestPermission(getMessaging());
    return isAuthorized(status) ? "granted" : "denied";
  }

  async getToken(): Promise<string | null> {
    const { getMessaging, getToken, hasPermission } = messaging();
    const status = await hasPermission(getMessaging());
    if (!isAuthorized(status)) {
      return null;
    }
    try {
      const token = await getToken(getMessaging());
      return token.length > 0 ? token : null;
    } catch {
      // A recoverable read failure (registration not finished yet, a
      // transient platform error) degrades to null for the same reason
      // LocationAdapter.getCurrent() does -- see adapters/LocationAdapter.ts.
      return null;
    }
  }

  onTokenRefresh(callback: (token: string) => void): () => void {
    // Unconditional -- no permission gate, unlike onMessage/onNotificationOpened
    // below. A token is issued (and can go stale) independently of whether
    // notification permission was ever granted, and this is the only signal
    // that tells the app to re-send it to the backend. Gating this on
    // permission would recreate the exact failure this contract exists to
    // prevent: a driver whose token silently goes stale.
    const { getMessaging, onTokenRefresh } = messaging();
    let unsubscribeNative: (() => void) | null = onTokenRefresh(getMessaging(), callback);
    // Guarded so calling the returned function twice does not depend on the
    // native remove() itself being idempotent.
    return () => {
      unsubscribeNative?.();
      unsubscribeNative = null;
    };
  }

  onMessage(callback: (message: PushMessage) => void): () => void {
    return this.subscribeWhenAuthorized(
      (handler) => messaging().onMessage(messaging().getMessaging(), handler),
      callback,
    );
  }

  onNotificationOpened(callback: (message: PushMessage) => void): () => void {
    return this.subscribeWhenAuthorized(
      (handler) => messaging().onNotificationOpenedApp(messaging().getMessaging(), handler),
      callback,
    );
  }

  /**
   * Shared plumbing for onMessage/onNotificationOpened: both only make sense
   * once permission is granted (there is nothing useful to show or route on
   * for a user who declined), so both check current permission — without
   * prompting for it, same convention as LocationProvider's watch() reading
   * getForegroundPermissionsAsync() rather than requesting -- before
   * subscribing.
   *
   * hasPermission() is async, so the underlying native listener is not
   * necessarily registered by the time this method returns; the returned
   * unsubscribe must still be safe to call immediately (before that native
   * listener exists) without leaking it once it does get established. Same
   * `stopped`-flag shape as LocationAdapter.watch.
   */
  private subscribeWhenAuthorized(
    subscribe: (handler: (message: RemoteMessage) => void) => () => void,
    callback: (message: PushMessage) => void,
  ): () => void {
    let stopped = false;
    let unsubscribeNative: (() => void) | null = null;

    void (async () => {
      const { getMessaging, hasPermission } = messaging();
      const status = await hasPermission(getMessaging());
      if (!isAuthorized(status) || stopped) {
        return;
      }
      const remove = subscribe((remoteMessage) => {
        callback(toPushMessage(toPrimitives(remoteMessage)));
      });
      if (stopped) {
        remove();
        return;
      }
      unsubscribeNative = remove;
    })().catch(() => {
      // hasPermission() rejecting would otherwise be an unhandled promise
      // rejection -- a fatal in some React Native configurations, per the
      // same convention LocationAdapter.watch's onError catch documents.
      // There is no onError parameter on this contract (unlike
      // LocationWatchOptions), since a failed permission check here simply
      // means the caller never receives a message, the same outcome as a
      // denied permission -- not a new failure mode worth a dedicated hook.
    });

    return () => {
      stopped = true;
      unsubscribeNative?.();
      unsubscribeNative = null;
    };
  }
}
