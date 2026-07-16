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
    refreshToken: {
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
  let tokens: Mocked<{
    issueTokenPair: unknown;
    rotate: unknown;
    revoke: unknown;
    issueSocialDraftToken: unknown;
    verifySocialDraftToken: unknown;
  }>;
  let firebaseAdmin: Mocked<{
    assertPhoneMatches: unknown;
    assertPhoneOrEmailMatches: unknown;
    verifySocialToken: unknown;
  }>;
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
      issueSocialDraftToken: jest.fn().mockResolvedValue('social.draft.jwt'),
      verifySocialDraftToken: jest.fn(),
    };
    firebaseAdmin = {
      assertPhoneMatches: jest.fn().mockResolvedValue(undefined),
      assertPhoneOrEmailMatches: jest.fn().mockResolvedValue(undefined),
      verifySocialToken: jest.fn(),
    };
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

  describe('register - social sign-up', () => {
    it('creates a user from a valid social draft token, no password hash', async () => {
      tokens.verifySocialDraftToken.mockResolvedValue({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', ...data }),
      );

      const dto = {
        email: 'kofi@example.com',
        phone: '+233201234567',
        fullName: 'Kofi Mensah',
        role: 'client',
        countryCode: 'GHA',
        firebaseIdToken: 'phone-proof-token',
        socialDraftToken: 'social-draft-token',
      };

      const result = await service.register(dto as never);

      expect(tokens.verifySocialDraftToken).toHaveBeenCalledWith('social-draft-token');
      expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBeNull();
      expect(prisma.user.create.mock.calls[0][0].data.authProvider).toBe('google');
      expect(result.user.email).toBe('kofi@example.com');
    });

    it('rejects a social draft token whose email does not match the submitted email', async () => {
      tokens.verifySocialDraftToken.mockResolvedValue({
        email: 'someone-else@example.com',
        provider: 'google',
      });
      const dto = {
        email: 'kofi@example.com',
        phone: '+233201234567',
        fullName: 'Kofi Mensah',
        role: 'client',
        countryCode: 'GHA',
        firebaseIdToken: 'phone-proof-token',
        socialDraftToken: 'social-draft-token',
      };
      await expect(service.register(dto as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a request supplying both password and socialDraftToken', async () => {
      const dto = {
        email: 'kofi@example.com',
        phone: '+233201234567',
        fullName: 'Kofi Mensah',
        role: 'client',
        countryCode: 'GHA',
        firebaseIdToken: 'phone-proof-token',
        password: 'SecurePass123!',
        socialDraftToken: 'social-draft-token',
      };
      await expect(service.register(dto as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(tokens.verifySocialDraftToken).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('issues a challenge for valid credentials (no tokens yet)', async () => {
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
      expect(result.challengeId).toEqual(expect.any(String));
      expect(redis.setValueEx).toHaveBeenCalledWith(
        `login:challenge:${result.challengeId}`,
        'u1',
        300,
      );
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

    it('rejects a social-only account (null passwordHash) with 401, not a crash', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash: null,
        isActive: true,
      });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'anything1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('verifyLoginChallenge', () => {
    it('issues tokens when the challenge and Firebase proof are valid', async () => {
      redis.getValue.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        email: 'kofi@example.com',
        isActive: true,
      });
      firebaseAdmin.assertPhoneOrEmailMatches.mockResolvedValue(undefined);

      const result = await service.verifyLoginChallenge({
        challengeId: 'chal-1',
        firebaseIdToken: 'tok',
      } as never);

      expect(firebaseAdmin.assertPhoneOrEmailMatches).toHaveBeenCalledWith(
        'tok',
        '+233201234567',
        'kofi@example.com',
      );
      expect(redis.del).toHaveBeenCalledWith('login:challenge:chal-1');
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects an expired or unknown challenge', async () => {
      redis.getValue.mockResolvedValue(null);
      await expect(
        service.verifyLoginChallenge({ challengeId: 'chal-1', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the Firebase proof does not match', async () => {
      redis.getValue.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        email: 'kofi@example.com',
        isActive: true,
      });
      firebaseAdmin.assertPhoneOrEmailMatches.mockRejectedValue(new BadRequestException('mismatch'));
      await expect(
        service.verifyLoginChallenge({ challengeId: 'chal-1', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
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

  describe('socialLogin', () => {
    it('logs in an existing account directly (no draft token)', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'kofi@example.com', name: 'Kofi' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'kofi@example.com',
        isActive: true,
      });

      const result = await service.socialLogin({
        firebaseIdToken: 'tok',
        provider: 'google',
      } as never);

      expect('accessToken' in result && result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects a suspended existing account', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'kofi@example.com' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'kofi@example.com', isActive: false });
      await expect(
        service.socialLogin({ firebaseIdToken: 'tok', provider: 'google' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a social draft token for a brand-new account, no User row created', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'new@example.com', name: 'New Person' });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.socialLogin({
        firebaseIdToken: 'tok',
        provider: 'facebook',
      } as never);

      expect(result).toEqual({
        isNewAccount: true,
        socialDraftToken: expect.any(String),
        email: 'new@example.com',
        fullName: 'New Person',
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password and revokes existing refresh tokens', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+233201234567' });
      prisma.user.update = jest.fn().mockResolvedValue({});
      prisma.refreshToken = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };

      const result = await service.resetPassword({
        phone: '+233201234567',
        firebaseIdToken: 'tok',
        newPassword: 'NewSecurePass123!',
      } as never);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown phone number', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          phone: '+233200000000',
          firebaseIdToken: 'tok',
          newPassword: 'NewSecurePass123!',
        } as never),
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
