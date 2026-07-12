import { BadRequestException, Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { OtpPurpose, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OTP_PROVIDER, OtpProvider } from './otp-provider.interface';

interface OtpTarget {
  phone?: string;
  email?: string;
}

/**
 * Issues and verifies one-time codes. Codes are hashed at rest (bcrypt),
 * expire after OTP_TTL_MIN, are single-use, and sending is throttled per target.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
  ) {}

  async send(target: OtpTarget, purpose: OtpPurpose): Promise<{ expiresAt: Date }> {
    this.assertTarget(target);
    await this.assertNotThrottled(target);

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, this.config.get('BCRYPT_ROUNDS'));
    const expiresAt = new Date(Date.now() + this.config.get('OTP_TTL_MIN') * 60_000);

    await this.prisma.otpCode.create({
      data: {
        phone: target.phone ?? null,
        email: target.email ?? null,
        codeHash,
        purpose,
        expiresAt,
      },
    });

    await this.provider.send(target, code);
    return { expiresAt };
  }

  /**
   * Verifies a code against the newest non-consumed, non-expired OTP for the
   * target. On success the code is marked consumed (single use).
   */
  async verify(target: OtpTarget, code: string, purpose: OtpPurpose): Promise<boolean> {
    this.assertTarget(target);

    const record = await this.prisma.otpCode.findFirst({
      where: {
        ...this.targetWhere(target),
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return false;
    }

    const matches = await bcrypt.compare(code, record.codeHash);
    if (!matches) {
      return false;
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  private generateCode(): string {
    const length = this.config.get('OTP_LENGTH');
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }

  private assertTarget(target: OtpTarget): void {
    if (!target.phone && !target.email) {
      throw new BadRequestException('Either phone or email is required for OTP.');
    }
  }

  private targetWhere(target: OtpTarget): Prisma.OtpCodeWhereInput {
    return target.phone ? { phone: target.phone } : { email: target.email };
  }

  private async assertNotThrottled(target: OtpTarget): Promise<void> {
    const windowStart = new Date(Date.now() - this.config.get('OTP_SEND_WINDOW_MIN') * 60_000);
    const recent = await this.prisma.otpCode.count({
      where: { ...this.targetWhere(target), createdAt: { gt: windowStart } },
    });
    if (recent >= this.config.get('OTP_SEND_MAX')) {
      throw new HttpException(
        'Too many OTP requests. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
