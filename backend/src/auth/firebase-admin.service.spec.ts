import { BadRequestException } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';

const verifyIdToken = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  cert: jest.fn((c: unknown) => c),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

describe('FirebaseAdminService', () => {
  const config = { get: jest.fn() };
  let service: FirebaseAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(JSON.stringify({ project_id: 'kaya-a24e7' }));
    service = new FirebaseAdminService(config as never);
  });

  it('resolves when the token phone claim matches', async () => {
    verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
    await expect(
      service.assertPhoneMatches('token', '+233201234567'),
    ).resolves.toBeUndefined();
  });

  it('rejects when the phone claim does not match', async () => {
    verifyIdToken.mockResolvedValue({ phone_number: '+233209999999' });
    await expect(
      service.assertPhoneMatches('token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid'));
    await expect(
      service.assertPhoneMatches('bad-token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when Firebase Admin failed to initialize', async () => {
    config.get.mockReturnValue('not-json');
    const misconfigured = new FirebaseAdminService(config as never);
    await expect(
      misconfigured.assertPhoneMatches('token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('assertPhoneOrEmailMatches', () => {
    it('resolves when the phone claim matches', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).resolves.toBeUndefined();
    });

    it('resolves when the email claim matches (case-insensitive)', async () => {
      verifyIdToken.mockResolvedValue({ email: 'Kofi@Example.com' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).resolves.toBeUndefined();
    });

    it('rejects when neither claim matches', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233209999999', email: 'other@example.com' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid token', async () => {
      verifyIdToken.mockRejectedValue(new Error('invalid'));
      await expect(
        service.assertPhoneOrEmailMatches('bad-token', '+233201234567', 'kofi@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifySocialToken', () => {
    it('returns the email and name claims for a verified-email token', async () => {
      verifyIdToken.mockResolvedValue({
        email: 'kofi@example.com',
        email_verified: true,
        name: 'Kofi Mensah',
      });
      await expect(service.verifySocialToken('token')).resolves.toEqual({
        email: 'kofi@example.com',
        name: 'Kofi Mensah',
      });
    });

    it('rejects a token with no email claim', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
      await expect(service.verifySocialToken('token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a token whose email is not verified', async () => {
      verifyIdToken.mockResolvedValue({ email: 'kofi@example.com', email_verified: false });
      await expect(service.verifySocialToken('token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid token', async () => {
      verifyIdToken.mockRejectedValue(new Error('invalid'));
      await expect(service.verifySocialToken('bad-token')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
