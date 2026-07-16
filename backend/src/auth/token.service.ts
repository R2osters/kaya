import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface SocialDraftClaims {
  email: string;
  fullName?: string;
  provider: 'google' | 'facebook';
}

/**
 * Mints access tokens (RS256 JWT) and opaque refresh tokens.
 *
 * Refresh tokens are formatted `<recordId>.<secret>`; only a bcrypt hash of the
 * secret is stored. Refreshing rotates the token: the presented token is
 * revoked and its `replacedById` points at the newly issued record.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async issueTokenPair(user: Pick<User, 'id' | 'email' | 'role' | 'countryCode'>): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.accessTtl,
    };
  }

  /**
   * Short-lived (15 min) signed token proving a Google/Facebook sign-in for
   * an email with no existing account yet. Carries a distinct `purpose`
   * claim so JwtStrategy (which only accepts `type: 'access'`) rejects it if
   * presented as a Bearer token — see backend/src/auth/strategies/jwt.strategy.ts.
   */
  async issueSocialDraftToken(claims: SocialDraftClaims): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, purpose: 'social_draft' },
      { expiresIn: '15m' },
    );
  }

  async verifySocialDraftToken(token: string): Promise<SocialDraftClaims> {
    let payload: SocialDraftClaims & { purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired social sign-in token.');
    }
    if (payload.purpose !== 'social_draft') {
      throw new UnauthorizedException('Invalid token type.');
    }
    return { email: payload.email, fullName: payload.fullName, provider: payload.provider };
  }

  /** Validates and rotates a refresh token, returning a fresh pair. */
  async rotate(presentedToken: string): Promise<TokenPair> {
    const record = await this.findValidRefreshRecord(presentedToken);

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }

    const accessToken = await this.signAccessToken(user);
    const newRefresh = await this.createRefreshToken(user.id);
    const newRecordId = newRefresh.split('.')[0];

    // Revoke the old token and link it to its replacement (rotation trail).
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: newRecordId },
    });

    return {
      accessToken,
      refreshToken: newRefresh,
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.accessTtl,
    };
  }

  /** Revokes a refresh token (logout). Silent when the token is unknown. */
  async revoke(presentedToken: string): Promise<void> {
    const [id, secret] = this.splitToken(presentedToken);
    if (!id || !secret) {
      return;
    }
    const record = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!record || record.revokedAt) {
      return;
    }
    const matches = await bcrypt.compare(secret, record.tokenHash);
    if (matches) {
      await this.prisma.refreshToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async signAccessToken(
    user: Pick<User, 'id' | 'email' | 'role' | 'countryCode'>,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      countryCode: user.countryCode,
      type: 'access',
    };
    return this.jwt.signAsync(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const secret = randomBytes(48).toString('hex');
    const tokenHash = await bcrypt.hash(secret, this.config.get('BCRYPT_ROUNDS'));
    const expiresAt = new Date(Date.now() + this.config.jwt.refreshTtl * 1000);

    const record = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return `${record.id}.${secret}`;
  }

  private async findValidRefreshRecord(presentedToken: string) {
    const [id, secret] = this.splitToken(presentedToken);
    if (!id || !secret) {
      throw new UnauthorizedException('Malformed refresh token.');
    }
    const record = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }
    const matches = await bcrypt.compare(secret, record.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }
    return record;
  }

  private splitToken(token: string): [string | undefined, string | undefined] {
    const idx = token.indexOf('.');
    if (idx <= 0) {
      return [undefined, undefined];
    }
    return [token.slice(0, idx), token.slice(idx + 1)];
  }
}
