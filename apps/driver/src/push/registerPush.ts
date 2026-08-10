import type { PushProvider } from "@kaya/core";
import { api } from "../api/client";

/**
 * Sends a device token to the backend, which stores it on the user row
 * (`fcmToken` on `PUT /auth/profile`, see backend/src/auth/dto/update-profile.dto.ts)
 * and sends to it from NotificationsService.
 *
 * Failure is swallowed on purpose. A token that fails to reach the backend
 * means notifications are degraded until the next launch or the next rotation,
 * which is bad; an unhandled rejection escaping a fire-and-forget effect in the
 * root layout takes the whole app down, which is worse. It is warned about so
 * the cause is visible in logcat.
 */
async function sendToken(token: string): Promise<void> {
  try {
    await api.updateProfile({ fcmToken: token });
  } catch (error) {
    console.warn("[push] failed to register the device token with the backend", error);
  }
}

/**
 * Registers this device for push, and keeps the registration current.
 *
 * Returns an unsubscribe. Call it on sign-out or teardown; it is safe to call
 * more than once.
 *
 * The rotation subscription is the part that matters, and it is why this is not
 * a single `getToken()` call at sign-in. FCM rotates tokens on its own schedule
 * -- app reinstall, restore to a new device, an occasional server-side refresh
 * -- and a stale token on the backend fails silently in exactly the worst way
 * for this product: per the decisions log, push is the only channel that
 * reaches a driver about new work, so a driver whose token has rotated stops
 * being offered deliveries and concludes the platform has gone quiet. Nothing
 * in the app would report it.
 *
 * The subscription is attached *before* the first token is read, so a rotation
 * that lands during that read is not missed.
 *
 * A denied permission is an ordinary outcome, not an error: `getToken()`
 * resolves null and this returns a working unsubscribe having registered
 * nothing. The rotation listener is still attached, because FCM issues tokens
 * regardless of notification permission and the user may grant it later from
 * system settings -- at which point the backend already has somewhere to send.
 */
export async function registerPush(push: PushProvider): Promise<() => void> {
  // The whole registration is guarded, not just the network call inside
  // sendToken. Found on a device: with no google-services.json present,
  // @react-native-firebase throws "No Firebase App '[DEFAULT]' has been
  // created" out of the *adapter* -- before any token exists -- and it
  // surfaced as an uncaught promise rejection over the first screen after
  // sign-in. The unit tests could not see it: they substitute the whole
  // PushProvider, so the case where the provider itself throws never arose.
  //
  // A device without Firebase configured must degrade to "no push", which is
  // a real and common configuration: every developer checkout, and every
  // build made before the google-services file is added.
  try {
    const unsubscribe = push.onTokenRefresh((token) => {
      void sendToken(token);
    });

    await push.requestPermission();

    const token = await push.getToken();
    if (token !== null && token !== "") {
      await sendToken(token);
    }

    return unsubscribe;
  } catch (error) {
    console.warn("[push] not registered; notifications are unavailable", error);
    return () => undefined;
  }
}
