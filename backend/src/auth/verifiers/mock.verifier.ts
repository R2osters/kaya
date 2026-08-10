import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PhoneVerifier } from '../phone-verifier.interface';

/**
 * Prefix a mock token must carry. Chosen so a token cannot be mistaken for a
 * real Firebase JWT (which is three base64 segments separated by dots) and so
 * that anything arriving from a real client is rejected rather than trusted.
 */
const MOCK_PREFIX = 'dev:';

/**
 * Development-only verifier. Accepts `dev:+233201234567` as proof of
 * possession of `+233201234567`, and nothing else.
 *
 * **This is an authentication bypass.** Anyone who can reach a backend running
 * it can mint a session for any account whose phone or email they know. It
 * exists because phone verification was the only external integration in this
 * project without a keyless implementation, which made a fresh checkout
 * unable to log in at all -- but the convenience is not worth a quiet failure
 * mode, so three things constrain it:
 *
 *  - `AuthModule` refuses to construct this class when `NODE_ENV=production`.
 *    It throws at boot rather than logging a warning, because a warning in a
 *    startup log is not a control.
 *  - Only the `dev:` prefix is accepted. A real Firebase ID token presented to
 *    this verifier is rejected, so a client accidentally pointed at a mock
 *    backend fails loudly instead of appearing to work.
 *  - Every acceptance is logged at warn level with the phone it authenticated,
 *    so a backend left in this mode is obvious in its own logs.
 *
 * The email branch of `assertPhoneOrEmailMatches` accepts `dev:<email>` too,
 * since password-login 2FA lets the user pick the channel.
 */
@Injectable()
export class MockPhoneVerifier implements PhoneVerifier {
  readonly name = 'mock';
  private readonly logger = new Logger('MockPhoneVerifier');

  /**
   * Returns the subject a mock token asserts, or throws. Shared by the three
   * assertions so the prefix rule cannot drift between them.
   *
   * The callers below are `async` deliberately. Rejecting a bad token by
   * throwing synchronously out of a method whose signature says `Promise`
   * would make this class behave differently from FirebaseVerifier: a caller
   * using `.catch()` rather than `await` would take an uncaught exception
   * instead of a handled rejection. Its own tests caught that.
   */
  private subjectOf(idToken: string): string {
    if (!idToken.startsWith(MOCK_PREFIX)) {
      throw new BadRequestException('Invalid or expired phone verification.');
    }
    const subject = idToken.slice(MOCK_PREFIX.length).trim();
    if (subject === '') {
      throw new BadRequestException('Invalid or expired phone verification.');
    }
    return subject;
  }

  async assertPhoneMatches(idToken: string, expectedPhone: string): Promise<void> {
    const subject = this.subjectOf(idToken);
    if (subject !== expectedPhone) {
      throw new BadRequestException(
        'Phone verification does not match the submitted phone number.',
      );
    }
    this.logger.warn(`MOCK phone verification accepted for ${expectedPhone}.`);
  }

  async assertPhoneOrEmailMatches(
    idToken: string,
    expectedPhone: string,
    expectedEmail: string,
  ): Promise<void> {
    const subject = this.subjectOf(idToken);
    const matches =
      subject === expectedPhone || subject.toLowerCase() === expectedEmail.toLowerCase();
    if (!matches) {
      throw new BadRequestException('Verification does not match the account.');
    }
    this.logger.warn(`MOCK verification accepted for ${subject}.`);
  }

  async verifySocialToken(idToken: string): Promise<{ email: string; name?: string }> {
    const subject = this.subjectOf(idToken);
    if (!subject.includes('@')) {
      throw new BadRequestException('Social sign-in token has no email.');
    }
    this.logger.warn(`MOCK social verification accepted for ${subject}.`);
    return { email: subject.toLowerCase() };
  }
}
