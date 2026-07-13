import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { CountryCode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { RegisterRole } from './dto/register.dto';

// AuthService imports FirebaseAdminService, which imports the real
// firebase-admin/auth SDK (pulls in the ESM-only `jose` package via
// jwks-rsa, which Jest's CommonJS transform can't parse). This suite
// never exercises the real SDK — a plain mock stands in for
// `firebaseAdmin` below — so stub these modules before importing
// AuthService, matching firebase-admin.service.spec.ts.
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  cert: jest.fn((c: unknown) => c),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
}));

// eslint-disable-next-line import/first
import { AuthService } from './auth.service';

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
  let firebaseAdmin: Mocked<{ assertPhoneMatches: unknown }>;
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
    firebaseIdToken: 'test-firebase-id-token-0000000000',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    tokens = {
      issueTokenPair: jest.fn().mockResolvedValue(TOKEN_PAIR),
      rotate: jest.fn().mockResolvedValue(TOKEN_PAIR),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    firebaseAdmin = { assertPhoneMatches: jest.fn().mockResolvedValue(undefined) };
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
      firebaseAdmin as never,
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
        firebaseIdToken: 'test-firebase-id-token-0000000000',
      } as never);

      expect(result.user.driverLicenseNumber).toBeNull();
    });

    it('rejects a duplicate email/phone with a conflict', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'kofi@example.com', phone: 'x' });
      await expect(service.register(baseDriver as never)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('register - Firebase phone verification', () => {
    it('rejects when the Firebase token phone does not match the submitted phone', async () => {
      firebaseAdmin.assertPhoneMatches.mockRejectedValue(new BadRequestException('mismatch'));
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.register(baseDriver as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('marks the new user verified once Firebase confirms the phone', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', passwordHash: 'x', ...data }),
      );
      const result = await service.register(baseDriver as never);
      expect(firebaseAdmin.assertPhoneMatches).toHaveBeenCalledWith(
        baseDriver.firebaseIdToken,
        baseDriver.phone,
      );
      expect(prisma.user.create.mock.calls[0][0].data.isVerified).toBe(true);
      expect(result.user.driverLicenseNumber).toBe('PCSRC-2024-001234');
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

  describe('loginWithOtp', () => {
    it('logs in an active user once Firebase confirms the phone', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        isActive: true,
      });
      const result = await service.loginWithOtp({
        phone: '+233201234567',
        firebaseIdToken: 'tok',
      } as never);
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects an unknown phone number', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.loginWithOtp({ phone: '+233200000000', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a suspended account', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(
        service.loginWithOtp({ phone: '+233201234567', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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
