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
import { OtpService } from './otp/otp.service';
import { OTP_PROVIDER } from './otp/otp-provider.interface';
import { DevOtpProvider } from './otp/dev-otp.provider';

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
    OtpService,
    JwtStrategy,
    // OTP provider is selected here; production would branch on OTP_PROVIDER.
    { provide: OTP_PROVIDER, useClass: DevOtpProvider },
    // Global guards: authenticate everything (except @Public), then check @Roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
