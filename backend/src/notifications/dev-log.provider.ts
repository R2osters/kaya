import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider, PushPayload } from './notification-provider.interface';

/**
 * Default notification provider: logs the payload instead of calling FCM.
 * Used in dev and anywhere Firebase credentials are absent.
 */
@Injectable()
export class DevLogProvider implements NotificationProvider {
  readonly name = 'dev-log';
  private readonly logger = new Logger('Push');

  async send(deviceToken: string, payload: PushPayload): Promise<void> {
    this.logger.debug(
      `[DEV PUSH] -> ${deviceToken.slice(0, 8)}...: ${payload.title} - ${payload.body}`,
    );
  }
}
