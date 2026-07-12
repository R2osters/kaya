import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { MapsModule } from './maps/maps.module';
import { GeoModule } from './geo/geo.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LedgerModule } from './ledger/ledger.module';
import { CommissionModule } from './commission/commission.module';
import { OrdersModule } from './orders/orders.module';
import { OffersModule } from './offers/offers.module';
import { MessagesModule } from './messages/messages.module';
import { PaymentsModule } from './payments/payments.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { RatingsModule } from './ratings/ratings.module';
import { DriverModule } from './driver/driver.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Global IP rate limiting (default 100 req / 60s, from env).
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL'),
            limit: config.get('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    // Global infrastructure modules.
    RedisModule,
    MapsModule,
    GeoModule,
    NotificationsModule,
    RealtimeModule,
    StorageModule,
    LedgerModule,
    CommissionModule,
    // Feature modules.
    AuthModule,
    OrdersModule,
    OffersModule,
    MessagesModule,
    PaymentsModule,
    DeliveriesModule,
    RatingsModule,
    DriverModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // IP rate limiting runs before the auth/roles guards declared in AuthModule.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
