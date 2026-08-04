import { notificationType } from "../wire/enums";
import type { NotificationType } from "../wire/enums";

/**
 * A push message normalized for app code: whatever
 * @react-native-firebase/messaging's RemoteMessage carried, reduced to
 * primitives a screen can route on without depending on Firebase's own
 * types. Handing the raw RemoteMessage to callers instead would drag
 * @react-native-firebase/messaging's types into every screen that reads a
 * notification, exactly the coupling this interface exists to avoid (see
 * PushProvider below).
 */
export interface PushMessage {
  /**
   * Notification category, for routing a tap or a foreground banner to the
   * right screen (order detail, offer list, delivery tracking, ...). Coerced
   * with the same "unknown value falls back to system" rule
   * AppNotification.type uses (models/notification.ts), via toPushMessage()
   * below.
   *
   * Backend's NotificationsService.notify()
   * (backend/src/notifications/notifications.service.ts) puts `type` into
   * the FCM data payload it sends, alongside storing it on the persisted
   * Notification row, so a screen can route on it directly off the push
   * without waiting on a fetch. The "unknown value falls back to system"
   * fallback above still applies to whatever value actually arrives -- a
   * malformed or unexpected payload degrades rather than crashing the
   * screen -- but the ordinary case is a real, routable type on every push.
   */
  type: NotificationType;
  /** The notification's display title, if the message carried one (data-only messages do not). */
  title: string | null;
  /** The notification's display body, if the message carried one. */
  body: string | null;
  /**
   * The raw string-keyed data payload from the backend — e.g. orderId,
   * offerId, deliveryId, livreurId. FCM data payloads are string-valued only
   * (see NotificationsService.stringifyData), so no further coercion happens
   * here; a screen that needs a typed id reads it out of this map itself.
   */
  data: Record<string, string>;
}

/**
 * Builds a PushMessage from the primitive fields an inbound message carries.
 * Kept here rather than in the @kaya/ui adapter so the "how does a raw
 * message become something a screen can route on" rule is unit-testable
 * without booting React Native — the adapter's job is only to pull these
 * primitives out of whatever @react-native-firebase/messaging's
 * RemoteMessage shape hands it.
 */
export function toPushMessage(input: {
  title?: string | null;
  body?: string | null;
  data?: Record<string, string>;
}): PushMessage {
  const data = input.data ?? {};
  return {
    type: notificationType.parse(data["type"]),
    title: input.title ?? null,
    body: input.body ?? null,
    data,
  };
}

/**
 * Platform boundary for push notifications. The driver app's new-request
 * popup depends on this interface, never on
 * @react-native-firebase/messaging directly — per the decisions log of
 * 2026-07-11, nearby polling plus FCM is what drives that popup, since v1
 * deliberately has no driver-facing socket event. The concrete
 * implementation lives in @kaya/ui: see
 * packages/kaya-ui/src/adapters/PushAdapter.ts.
 *
 * Constraint that matters beyond this interface: @react-native-firebase/messaging
 * does not run under Expo Go — a development build is required. Whatever
 * consumes this in apps/ (phase 1C) has to account for that; it is not
 * solved here.
 *
 * Permission handling follows the same convention as LocationProvider (see
 * platform/location.ts): a refusal is an ordinary, recoverable outcome, not
 * an exception. requestPermission() reports it as a value, never a
 * rejection, and getToken() resolves null — never throws — when permission
 * is missing or a token could not be obtained.
 *
 * onTokenRefresh is part of this contract, not an implementation detail,
 * because FCM rotates tokens: a stale one on the backend means a driver
 * silently stops receiving delivery requests and simply thinks the platform
 * has gone quiet. Every screen or service that reads a token from this
 * interface must therefore also subscribe to onTokenRefresh and re-send the
 * new token, for as long as it cares about receiving pushes.
 *
 * As with LocationProvider.watch, every subscription method here returns
 * its own unsubscribe, which is always safe to call — including before the
 * underlying platform subscription was actually established, and more than
 * once — and is what actually stops delivery of further callbacks.
 */
export interface PushProvider {
  /** Requests notification permission. Never rejects for a refusal. */
  requestPermission(): Promise<"granted" | "denied">;

  /**
   * Reads the current device push token once. Resolves null — never rejects
   * — when permission is not granted or a token could not be obtained. Acts
   * on whatever permission state already exists; it does not itself trigger
   * the OS permission prompt (call requestPermission() first for that).
   */
  getToken(): Promise<string | null>;

  /**
   * Subscribes to token rotation and returns an unsubscribe. Fires whenever
   * the platform issues a new token, regardless of notification-permission
   * state — a token is meaningful bookkeeping to send to the backend even
   * before permission has been granted, and this is the only channel that
   * tells the app its previously-registered token is now stale.
   */
  onTokenRefresh(callback: (token: string) => void): () => void;

  /**
   * Subscribes to messages received while the app is in the foreground and
   * returns an unsubscribe. Never invokes `callback` while permission is not
   * currently granted; does not itself prompt for permission.
   */
  onMessage(callback: (message: PushMessage) => void): () => void;

  /**
   * Subscribes to the user tapping a notification to open (or foreground)
   * the app and returns an unsubscribe. Never invokes `callback` while
   * permission is not currently granted; does not itself prompt for
   * permission.
   */
  onNotificationOpened(callback: (message: PushMessage) => void): () => void;
}
