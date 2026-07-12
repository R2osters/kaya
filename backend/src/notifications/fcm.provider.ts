import { Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { AppConfigService } from '../config/app-config.service';
import { NotificationProvider, PushPayload } from './notification-provider.interface';

/**
 * Firebase Cloud Messaging provider. Only instantiated when
 * FIREBASE_SERVICE_ACCOUNT is set (see NotificationsModule). Initializes a
 * dedicated Firebase app from the service-account JSON; if initialization or a
 * send fails, it logs and no-ops so notifications never crash a request.
 */
@Injectable()
export class FcmProvider implements NotificationProvider {
  readonly name = 'fcm';
  private readonly logger = new Logger('Push');
  private app: App | null = null;

  constructor(private readonly config: AppConfigService) {
    try {
      const raw = this.config.get('FIREBASE_SERVICE_ACCOUNT');
      const credentials = JSON.parse(raw) as ServiceAccount;
      this.app = initializeApp({ credential: cert(credentials) }, 'kaya-fcm');
    } catch (err) {
      this.logger.warn(`FCM init failed; push disabled: ${(err as Error).message}`);
      this.app = null;
    }
  }

  async send(deviceToken: string, payload: PushPayload): Promise<void> {
    if (!this.app) {
      return;
    }
    try {
      await getMessaging(this.app).send({
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
    }
  }
}
