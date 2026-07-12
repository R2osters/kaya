import { BadRequestException, HttpException } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  const config = {
    get: jest.fn((key: string) => {
      const map: Record<string, number> = {
        BCRYPT_ROUNDS: 4,
        OTP_LENGTH: 6,
        OTP_TTL_MIN: 5,
        OTP_SEND_MAX: 3,
        OTP_SEND_WINDOW_MIN: 15,
      };
      return map[key];
    }),
  };

  function createPrismaMock() {
    return {
      otpCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
  }

  const provider = { name: 'dev', send: jest.fn() };
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: OtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    service = new OtpService(prisma as never, config as never, provider as never);
  });

  describe('send', () => {
    it('generates a 6-digit code, stores a hash, and delivers via the provider', async () => {
      prisma.otpCode.count.mockResolvedValue(0);
      prisma.otpCode.create.mockResolvedValue({ id: 'otp1' });

      await service.send({ phone: '+233201234567' }, OtpPurpose.phone_verification);

      const createArg = prisma.otpCode.create.mock.calls[0][0].data;
      expect(createArg.phone).toBe('+233201234567');
      // Code is hashed, never stored in the clear.
      expect(createArg.codeHash).not.toMatch(/^\d{6}$/);
      expect(provider.send).toHaveBeenCalledTimes(1);

      const deliveredCode = provider.send.mock.calls[0][1];
      expect(deliveredCode).toMatch(/^\d{6}$/);
    });

    it('throttles once the send limit for the window is reached', async () => {
      prisma.otpCode.count.mockResolvedValue(3); // == OTP_SEND_MAX
      await expect(
        service.send({ phone: '+233201234567' }, OtpPurpose.login),
      ).rejects.toBeInstanceOf(HttpException);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('requires a phone or an email', async () => {
      await expect(service.send({}, OtpPurpose.login)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verify', () => {
    it('accepts a matching, unexpired, unconsumed code and marks it consumed', async () => {
      const codeHash = await bcrypt.hash('123456', 4);
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'otp1',
        codeHash,
        consumedAt: null,
      });
      prisma.otpCode.update.mockResolvedValue({});

      const ok = await service.verify({ phone: '+233201234567' }, '123456', OtpPurpose.login);
      expect(ok).toBe(true);
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp1' },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('returns false when no valid code exists', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);
      const ok = await service.verify({ phone: '+233201234567' }, '123456', OtpPurpose.login);
      expect(ok).toBe(false);
    });

    it('returns false and does not consume when the code does not match', async () => {
      const codeHash = await bcrypt.hash('654321', 4);
      prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', codeHash, consumedAt: null });

      const ok = await service.verify({ phone: '+233201234567' }, '123456', OtpPurpose.login);
      expect(ok).toBe(false);
      expect(prisma.otpCode.update).not.toHaveBeenCalled();
    });
  });
});
