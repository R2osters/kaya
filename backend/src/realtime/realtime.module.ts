import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { EventsGateway } from './events.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Realtime (Socket.io) module. Global so REST services can inject
 * RealtimeService to push events. The gateway verifies handshake JWTs with the
 * same RS256 public key as the HTTP auth.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        publicKey: config.jwt.publicKey,
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
      }),
    }),
  ],
  providers: [EventsGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
