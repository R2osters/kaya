import { BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { PhoneVerifier } from '../phone-verifier.interface';
import { MockPhoneVerifier } from './mock.verifier';
import { selectPhoneVerifier } from './select-verifier';

const PHONE = '+233201234567';
const EMAIL = 'ama@example.com';

function configWith(verifier: string, production = false): AppConfigService {
  return {
    get: (key: string) => (key === 'FIREBASE_VERIFIER' ? verifier : ''),
    isProduction: production,
  } as unknown as AppConfigService;
}

describe('MockPhoneVerifier', () => {
  let verifier: MockPhoneVerifier;

  beforeEach(() => {
    verifier = new MockPhoneVerifier();
    // Every acceptance warns on purpose, so a backend left in this mode is
    // visible in its own logs. Silenced here to keep the suite readable.
    jest.spyOn(verifier['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('assertPhoneMatches', () => {
    it('accepts a dev token for the expected phone', async () => {
      await expect(verifier.assertPhoneMatches(`dev:${PHONE}`, PHONE)).resolves.toBeUndefined();
    });

    it('rejects a dev token for a different phone', async () => {
      // The bypass proves possession of the phone in the token, not of any
      // phone. Without this it would authenticate any account by id alone.
      await expect(verifier.assertPhoneMatches('dev:+22890000000', PHONE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a token without the dev prefix', async () => {
      // A real Firebase JWT presented here must fail rather than be trusted:
      // a client accidentally pointed at a mock backend should break loudly.
      const realLookingJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJwaG9uZV9udW1iZXIiOiIrMjMzIn0.sig';
      await expect(verifier.assertPhoneMatches(realLookingJwt, PHONE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an empty subject', async () => {
      await expect(verifier.assertPhoneMatches('dev:', PHONE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(verifier.assertPhoneMatches('dev:   ', PHONE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an empty token', async () => {
      await expect(verifier.assertPhoneMatches('', PHONE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('assertPhoneOrEmailMatches', () => {
    it('accepts either channel, since 2FA lets the user pick', async () => {
      await expect(
        verifier.assertPhoneOrEmailMatches(`dev:${PHONE}`, PHONE, EMAIL),
      ).resolves.toBeUndefined();
      await expect(
        verifier.assertPhoneOrEmailMatches(`dev:${EMAIL}`, PHONE, EMAIL),
      ).resolves.toBeUndefined();
    });

    it('matches the email case-insensitively', async () => {
      await expect(
        verifier.assertPhoneOrEmailMatches('dev:AMA@EXAMPLE.COM', PHONE, EMAIL),
      ).resolves.toBeUndefined();
    });

    it('rejects a subject that is neither', async () => {
      await expect(
        verifier.assertPhoneOrEmailMatches('dev:someone@else.com', PHONE, EMAIL),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifySocialToken', () => {
    it('returns the asserted email, lowercased', async () => {
      await expect(verifier.verifySocialToken('dev:AMA@example.com')).resolves.toEqual({
        email: 'ama@example.com',
      });
    });

    it('rejects a subject that is not an email', async () => {
      await expect(verifier.verifySocialToken(`dev:${PHONE}`)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('selectPhoneVerifier', () => {
  // Plain stubs: the selection rule never touches the implementations, and
  // importing the real FirebaseAdminService here would pull the firebase-admin
  // SDK's ESM dependencies into Jest.
  const firebase = { name: 'firebase' } as unknown as PhoneVerifier;
  const mock = { name: 'mock' } as unknown as PhoneVerifier;

  it('defaults to the real verifier', () => {
    expect(selectPhoneVerifier(configWith('firebase'), firebase, mock)).toBe(firebase);
  });

  it('treats any unrecognised value as the real verifier, failing closed', () => {
    expect(selectPhoneVerifier(configWith(''), firebase, mock)).toBe(firebase);
    expect(selectPhoneVerifier(configWith('MOCK'), firebase, mock)).toBe(firebase);
  });

  it('selects the mock in development when asked', () => {
    expect(selectPhoneVerifier(configWith('mock'), firebase, mock)).toBe(mock);
  });

  it('refuses to boot with the mock under NODE_ENV=production', () => {
    // Throwing, not warning. A process that starts with an auth bypass and a
    // line in its log is a process nobody notices; one that refuses to start
    // is a deployment that fails loudly.
    expect(() => selectPhoneVerifier(configWith('mock', true), firebase, mock)).toThrow(
      /development-only authentication bypass/,
    );
  });

  it('still boots in production with the real verifier', () => {
    expect(selectPhoneVerifier(configWith('firebase', true), firebase, mock)).toBe(firebase);
  });
});
