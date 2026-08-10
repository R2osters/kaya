import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { validateDriverFields } from './driver-validation';
import { RegisterDto, RegisterRole } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginOtpDto } from './dto/login-otp.dto';
import { LoginVerifyDto } from './dto/login-verify.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PHONE_VERIFIER, PhoneVerifier } from './phone-verifier.interface';
import { TokenPair, TokenService } from './token.service';

/** User shape returned to clients (never includes the password hash). */
export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenService,
    @Inject(PHONE_VERIFIER) private readonly verifier: PhoneVerifier,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser } & TokenPair> {
    // RegisterDto's @ValidateIf pair only rejects "neither password nor
    // socialDraftToken" - it can't express "not both" declaratively, so that
    // half of the mutually-exclusive contract is enforced here instead.
    if (dto.password && dto.socialDraftToken) {
      throw new BadRequestException(
        'Provide either a password or a social sign-in token, not both.',
      );
    }

    const includesLivreur = dto.role === RegisterRole.livreur || dto.role === RegisterRole.both;

    if (includesLivreur) {
      const error = validateDriverFields(dto.countryCode, {
        driverLicenseNumber: dto.driverLicenseNumber,
        driverQrCode: dto.driverQrCode,
      });
      if (error) {
        throw new BadRequestException(error);
      }
    }

    await this.verifier.assertPhoneMatches(dto.firebaseIdToken, dto.phone);
    await this.assertUnique(dto.email, dto.phone);

    let passwordHash: string | null = null;
    let authProvider: 'password' | 'google' | 'facebook' | 'apple' = 'password';
    if (dto.socialDraftToken) {
      const draft = await this.tokens.verifySocialDraftToken(dto.socialDraftToken);
      if (draft.email.toLowerCase() !== dto.email.toLowerCase()) {
        throw new BadRequestException('Social sign-in email does not match the submitted email.');
      }
      authProvider = draft.provider;
    } else {
      passwordHash = await bcrypt.hash(dto.password!, this.config.get('BCRYPT_ROUNDS'));
    }

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          authProvider,
          fullName: dto.fullName,
          age: dto.age,
          role: dto.role as unknown as Role,
          countryCode: dto.countryCode,
          city: dto.city,
          isVerified: true,
          driverLicenseNumber: includesLivreur ? dto.driverLicenseNumber : null,
          driverQrCode: includesLivreur ? dto.driverQrCode : null,
          vehicleType: includesLivreur ? dto.vehicleType : null,
          vehicleRegistration: includesLivreur ? dto.vehicleRegistration : null,
        },
      });
    } catch (err) {
      // Guard against a unique-constraint race between the check and the insert.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email or phone already registered.');
      }
      throw err;
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }

  async login(dto: LoginDto): Promise<{ challengeId: string }> {
    const identifier = dto.identifier.trim();
    const idKey = identifier.toLowerCase();

    // Brute-force protection: reject while a failure lock is active.
    await this.assertNotLocked(idKey);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
    });

    // Uniform error to avoid leaking which accounts exist. A social-only
    // account (null passwordHash) also falls into this branch — there is no
    // password to compare against, so it's treated the same as "wrong
    // password" rather than crashing bcrypt.compare with a null argument.
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.recordLoginFailure(idKey);
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    await this.clearLoginFailures(idKey);

    const challengeId = randomUUID();
    await this.redis.setValueEx(`login:challenge:${challengeId}`, user.id, 300);
    return { challengeId };
  }

  async verifyLoginChallenge(dto: LoginVerifyDto): Promise<{ user: PublicUser } & TokenPair> {
    const userId = await this.redis.getValue(`login:challenge:${dto.challengeId}`);
    if (!userId) {
      throw new BadRequestException('Login challenge expired or invalid.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.verifier.assertPhoneOrEmailMatches(dto.firebaseIdToken, user.phone, user.email);
    await this.redis.del(`login:challenge:${dto.challengeId}`);

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }

  async socialLogin(
    dto: SocialLoginDto,
  ): Promise<
    | ({ user: PublicUser } & TokenPair)
    | { isNewAccount: true; socialDraftToken: string; email: string; fullName?: string }
  > {
    const { email, name } = await this.verifier.verifySocialToken(dto.firebaseIdToken);
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      const socialDraftToken = await this.tokens.issueSocialDraftToken({
        email: email.toLowerCase(),
        fullName: name,
        provider: dto.provider,
      });
      return { isNewAccount: true, socialDraftToken, email: email.toLowerCase(), fullName: name };
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }

  async loginWithOtp(dto: LoginOtpDto): Promise<{ user: PublicUser } & TokenPair> {
    await this.verifier.assertPhoneMatches(dto.firebaseIdToken, dto.phone);

    const user = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }

  async resetPassword(dto: PasswordResetDto): Promise<{ success: boolean }> {
    await this.verifier.assertPhoneMatches(dto.firebaseIdToken, dto.phone);

    const user = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    if (!user) {
      throw new BadRequestException('Invalid request.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.config.get('BCRYPT_ROUNDS'));
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // --- login brute-force protection ---------------------------------------

  private async assertNotLocked(idKey: string): Promise<void> {
    const locked = await this.redis.getValue(`login:lock:${idKey}`);
    if (locked) {
      throw new HttpException(
        'Too many failed login attempts. Please wait and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordLoginFailure(idKey: string): Promise<void> {
    const windowSec = this.config.get('LOGIN_FAIL_WINDOW_MIN') * 60;
    const count = await this.redis.incrWithTtl(`login:fail:${idKey}`, windowSec);
    const lockAfter = this.config.get('LOGIN_LOCK_AFTER');
    const backoffAfter = this.config.get('LOGIN_BACKOFF_AFTER');

    if (count >= lockAfter) {
      // Hard lock (default 15 min).
      await this.redis.setValueEx(
        `login:lock:${idKey}`,
        '1',
        this.config.get('LOGIN_LOCK_MIN') * 60,
      );
    } else if (count >= backoffAfter) {
      // Exponential backoff (1s, 2s, 4s, ... capped at 5 min).
      const backoffSec = Math.min(2 ** (count - backoffAfter), 300);
      await this.redis.setValueEx(`login:lock:${idKey}`, '1', backoffSec);
    }
  }

  private async clearLoginFailures(idKey: string): Promise<void> {
    await this.redis.del(`login:fail:${idKey}`);
    await this.redis.del(`login:lock:${idKey}`);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    await this.tokens.revoke(refreshToken);
    return { success: true };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Account not found.');
    }
    return this.toPublic(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        age: dto.age,
        city: dto.city,
        vehicleType: dto.vehicleType,
        vehicleRegistration: dto.vehicleRegistration,
        fcmToken: dto.fcmToken,
      },
    });
    return this.toPublic(user);
  }

  async uploadIdCard(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<PublicUser> {
    const url = await this.storage.upload('id-cards', file);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { idCardPhoto: url },
    });
    return this.toPublic(user);
  }

  async uploadLicense(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<PublicUser> {
    const url = await this.storage.upload('licenses', file);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { driverLicensePhoto: url },
    });
    return this.toPublic(user);
  }

  private async assertUnique(email: string, phone: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'Email' : 'Phone';
      throw new ConflictException(`${field} already registered.`);
    }
  }

  /**
   * Strips the password hash and resolves stored photo KEYS to short-lived
   * presigned URLs (identity docs live in a private bucket). Inline data URIs
   * (e.g. scanned QR) and absolute URLs pass through unchanged.
   */
  private async toPublic(user: User): Promise<PublicUser> {
    const { passwordHash: _passwordHash, ...rest } = user;
    const [idCardPhoto, profilePhoto, driverLicensePhoto, driverQrCode, vehiclePhoto] =
      await Promise.all([
        this.storage.resolvePhoto(rest.idCardPhoto),
        this.storage.resolvePhoto(rest.profilePhoto),
        this.storage.resolvePhoto(rest.driverLicensePhoto),
        this.storage.resolvePhoto(rest.driverQrCode),
        this.storage.resolvePhoto(rest.vehiclePhoto),
      ]);
    return { ...rest, idCardPhoto, profilePhoto, driverLicensePhoto, driverQrCode, vehiclePhoto };
  }
}
