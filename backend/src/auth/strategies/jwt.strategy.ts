import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** Claims embedded in the signed access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  countryCode: string;
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // RS256: verify with the public key.
      secretOrKey: config.jwt.publicKey,
      algorithms: ['RS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type.');
    }

    // Confirm the account still exists and is active on every request.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, countryCode: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      countryCode: user.countryCode,
    };
  }
}
