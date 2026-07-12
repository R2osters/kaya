/** Injection token for the active notification (push) provider. */
export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Delivers a push notification to a device token. Implemented by a dev-log
 * provider (default, logs) and an FCM provider (active only when
 * FIREBASE_SERVICE_ACCOUNT is configured). Behind this interface so
 * notification logic never depends on Firebase being present.
 */
export interface NotificationProvider {
  readonly name: string;
  send(deviceToken: string, payload: PushPayload): Promise<void>;
}
