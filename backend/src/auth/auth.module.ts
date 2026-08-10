import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../config/app-config.service';
import { StorageModule } from '../storage/storage.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FirebaseAdminService } from './firebase-admin.service';
import { MockPhoneVerifier } from './verifiers/mock.verifier';
import { PHONE_VERIFIER } from './phone-verifier.interface';
import { selectPhoneVerifier } from './verifiers/select-verifier';

@Module({
  imports: [
    PassportModule,
    StorageModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        privateKey: config.jwt.privateKey,
        publicKey: config.jwt.publicKey,
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.jwt.accessTtl,
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    FirebaseAdminService,
    MockPhoneVerifier,
    {
      provide: PHONE_VERIFIER,
      inject: [AppConfigService, FirebaseAdminService, MockPhoneVerifier],
      useFactory: selectPhoneVerifier,
    },
    JwtStrategy,
    // Global guards: authenticate everything (except @Public), then check @Roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TokenService, PHONE_VERIFIER],
})
export class AuthModule {}
