import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { CountryCode, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RegisterRole } from './dto/register.dto';

// Minimal typed mocks for the collaborators AuthService depends on.
type Mocked<T> = { [K in keyof T]: jest.Mock };

function createPrismaMock() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

const TOKEN_PAIR = {
  accessToken: 'access.jwt',
  refreshToken: 'refresh-id.secret',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
};

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tokens: Mocked<{ issueTokenPair: unknown; rotate: unknown; revoke: unknown }>;
  let otp: Mocked<{ send: unknown; verify: unknown }>;
  let storage: Mocked<{ upload: unknown; resolvePhoto: unknown }>;
  let redis: Mocked<{ getValue: unknown; incrWithTtl: unknown; setValueEx: unknown; del: unknown }>;
  let service: AuthService;

  const config = {
    // Low bcrypt cost keeps unit tests fast.
    get: jest.fn((key: string) => (key === 'BCRYPT_ROUNDS' ? 4 : undefined)),
  };

  const baseDriver = {
    email: 'kofi@example.com',
    phone: '+233201234567',
    password: 'SecurePass123!',
    fullName: 'Kofi Mensah',
    role: RegisterRole.livreur,
    countryCode: CountryCode.GHA,
    driverLicenseNumber: 'PCSRC-2024-001234',
    driverQrCode: 'data:image/png;base64,abc',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    tokens = {
      issueTokenPair: jest.fn().mockResolvedValue(TOKEN_PAIR),
      rotate: jest.fn().mockResolvedValue(TOKEN_PAIR),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    otp = { send: jest.fn(), verify: jest.fn() };
    storage = {
      upload: jest.fn(),
      resolvePhoto: jest.fn().mockImplementation((value: string | null | undefined) =>
        Promise.resolve(value ?? null),
      ),
    };
    redis = {
      getValue: jest.fn().mockResolvedValue(null),
      incrWithTtl: jest.fn().mockResolvedValue(1),
      setValueEx: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as never,
      config as never,
      tokens as never,
      otp as never,
      storage as never,
      redis as never,
    );
  });

  describe('register - per-country driver validation', () => {
    it('registers a Ghana driver with a valid PCSRC number and returns tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', passwordHash: 'x', ...data }),
      );

      const result = await service.register(baseDriver as never);

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.user.driverLicenseNumber).toBe('PCSRC-2024-001234');
    });

    it('rejects a Ghana driver with an invalid license format', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.register({ ...baseDriver, driverLicenseNumber: 'BAD-1' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a Togo driver using the Ghana license format', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.register({
          ...baseDriver,
          countryCode: CountryCode.TGO,
          driverLicenseNumber: 'PCSRC-2024-001234',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not require driver fields for a pure client', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u2', passwordHash: 'x', ...data }),
      );

      const result = await service.register({
        email: 'client@example.com',
        phone: '+233209999999',
        password: 'SecurePass123!',
        fullName: 'Ama Client',
        role: RegisterRole.client,
        countryCode: CountryCode.GHA,
      } as never);

      expect(result.user.driverLicenseNumber).toBeNull();
    });

    it('rejects a duplicate email/phone with a conflict', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'kofi@example.com', phone: 'x' });
      await expect(service.register(baseDriver as never)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'kofi@example.com',
        role: 'livreur',
        countryCode: 'GHA',
        passwordHash,
        isActive: true,
      });

      const result = await service.login({
        identifier: 'kofi@example.com',
        password: 'SecurePass123!',
      });
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects a wrong password with 401', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash,
        isActive: true,
      });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown account with 401', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'nobody@example.com', password: 'whatever12' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a suspended account', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', passwordHash, isActive: false });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'SecurePass123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('otp', () => {
    it('delegates OTP send to the OTP service', async () => {
      const expiresAt = new Date();
      otp.send.mockResolvedValue({ expiresAt });
      const res = await service.sendOtp({ phone: '+233201234567' }, OtpPurpose.phone_verification);
      expect(otp.send).toHaveBeenCalledWith(
        { phone: '+233201234567' },
        OtpPurpose.phone_verification,
      );
      expect(res.expiresAt).toBe(expiresAt);
    });

    it('marks the account verified on a successful phone verification', async () => {
      otp.verify.mockResolvedValue(true);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      const res = await service.verifyOtp(
        { phone: '+233201234567' },
        '123456',
        OtpPurpose.phone_verification,
      );
      expect(res.verified).toBe(true);
      expect(prisma.user.updateMany).toHaveBeenCalled();
    });

    it('throws on an invalid OTP code', async () => {
      otp.verify.mockResolvedValue(false);
      await expect(
        service.verifyOtp({ phone: '+233201234567' }, '000000', OtpPurpose.login),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('refresh / logout', () => {
    it('rotates via the token service', async () => {
      const res = await service.refresh('refresh-id.secret');
      expect(tokens.rotate).toHaveBeenCalledWith('refresh-id.secret');
      expect(res.refreshToken).toBe(TOKEN_PAIR.refreshToken);
    });

    it('revokes via the token service on logout', async () => {
      const res = await service.logout('refresh-id.secret');
      expect(tokens.revoke).toHaveBeenCalledWith('refresh-id.secret');
      expect(res.success).toBe(true);
    });
  });
});
