import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';
import { DevLogProvider } from './dev-log.provider';
import { FcmProvider } from './fcm.provider';

/**
 * Global notifications. The provider is FCM when FIREBASE_SERVICE_ACCOUNT is
 * configured, otherwise the dev-log provider (works without any credentials).
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DevLogProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [AppConfigService, DevLogProvider],
      useFactory: (config: AppConfigService, devLog: DevLogProvider) =>
        config.get('FIREBASE_SERVICE_ACCOUNT') ? new FcmProvider(config) : devLog,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
