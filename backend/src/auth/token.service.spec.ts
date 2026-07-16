import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TokenService } from './token.service';

describe('TokenService - refresh rotation', () => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('new.access.jwt') };
  const config = {
    get: jest.fn((key: string) => (key === 'BCRYPT_ROUNDS' ? 4 : undefined)),
    jwt: {
      accessTtl: 900,
      refreshTtl: 604800,
      issuer: 'kaya-api',
      audience: 'kaya-app',
      privateKey: 'priv',
      publicKey: 'pub',
    },
  };

  function createPrismaMock() {
    return {
      user: { findUnique: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    service = new TokenService(jwt as never, prisma as never, config as never);
  });

  it('rotates a valid refresh token: revokes the old one and links the replacement', async () => {
    const secret = 'the-secret-value';
    const tokenHash = await bcrypt.hash(secret, 4);
    const presented = `old-id.${secret}`;

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'u1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      role: 'client',
      countryCode: 'GHA',
      isActive: true,
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 'new-id' });

    const pair = await service.rotate(presented);

    expect(pair.accessToken).toBe('new.access.jwt');
    expect(pair.refreshToken.startsWith('new-id.')).toBe(true);

    // Old token revoked and pointed at its replacement.
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-id' },
      data: expect.objectContaining({ replacedById: 'new-id', revokedAt: expect.any(Date) }),
    });
  });

  it('rejects an already-revoked refresh token', async () => {
    const secret = 's';
    const tokenHash = await bcrypt.hash(secret, 4);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'u1',
      tokenHash,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.rotate(`old-id.${secret}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired refresh token', async () => {
    const secret = 's';
    const tokenHash = await bcrypt.hash(secret, 4);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'u1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.rotate(`old-id.${secret}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed refresh token', async () => {
    await expect(service.rotate('no-dot-here')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose secret does not match the stored hash', async () => {
    const tokenHash = await bcrypt.hash('real-secret', 4);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'u1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.rotate('old-id.wrong-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('TokenService - social draft tokens', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'BCRYPT_ROUNDS' ? 4 : undefined)),
    jwt: {
      accessTtl: 900,
      refreshTtl: 604800,
      issuer: 'kaya-api',
      audience: 'kaya-app',
      privateKey: 'priv',
      publicKey: 'pub',
    },
  };
  const jwt = new JwtService({ secret: 'test-secret-for-social-draft-tokens' });
  let prisma: { user: { findUnique: jest.Mock }; refreshToken: { create: jest.Mock } };
  let service: TokenService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      refreshToken: { create: jest.fn().mockResolvedValue({ id: 'refresh-id' }) },
    };
    service = new TokenService(jwt, prisma as never, config as never);
  });

  describe('issueSocialDraftToken / verifySocialDraftToken', () => {
    it('round-trips the claims', async () => {
      const token = await service.issueSocialDraftToken({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
      const decoded = await service.verifySocialDraftToken(token);
      expect(decoded).toEqual({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
    });

    it('rejects a normal access token presented as a social draft token', async () => {
      const accessToken = await service.issueTokenPair({
        id: 'u1',
        email: 'kofi@example.com',
        role: 'client',
        countryCode: 'GHA',
      } as never);
      await expect(
        service.verifySocialDraftToken(accessToken.accessToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
