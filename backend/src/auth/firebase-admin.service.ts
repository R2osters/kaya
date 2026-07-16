import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AppConfigService } from '../config/app-config.service';

/**
 * Verifies Firebase Phone Auth ID tokens (see
 * docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
 * Initializes its own named app ('kaya-auth'), separate from the FCM
 * provider's ('kaya-fcm'), so the two integrations fail independently.
 */
@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger('FirebaseAuth');
  private app: App | null = null;

  constructor(private readonly config: AppConfigService) {
    try {
      const raw = this.config.get('FIREBASE_SERVICE_ACCOUNT');
      const credentials = JSON.parse(raw) as ServiceAccount;
      this.app = initializeApp({ credential: cert(credentials) }, 'kaya-auth');
    } catch (err) {
      this.logger.warn(`Firebase Admin init failed: ${(err as Error).message}`);
      this.app = null;
    }
  }

  /** Verifies the ID token and asserts its phone claim matches `expectedPhone`. */
  async assertPhoneMatches(idToken: string, expectedPhone: string): Promise<void> {
    if (!this.app) {
      throw new BadRequestException('Phone verification is not configured on the server.');
    }
    let decoded: { phone_number?: string };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired phone verification.');
    }
    if (decoded.phone_number !== expectedPhone) {
      throw new BadRequestException('Phone verification does not match the submitted phone number.');
    }
  }

  /**
   * Verifies the ID token and asserts it carries either the expected phone or
   * the expected VERIFIED email claim. Used for password-login 2FA, where the
   * user picks SMS or email as the verification channel — the backend accepts
   * whichever proof arrives rather than dictating the channel.
   *
   * The email branch requires `email_verified: true`: without it, an
   * attacker who already knows a victim's password could complete this 2FA
   * step with a token from a provider that emits unverified email claims
   * (e.g. a Facebook sign-in of their own, claiming the victim's email),
   * bypassing the actual possession proof this method exists to enforce.
   */
  async assertPhoneOrEmailMatches(
    idToken: string,
    expectedPhone: string,
    expectedEmail: string,
  ): Promise<void> {
    if (!this.app) {
      throw new BadRequestException('Verification is not configured on the server.');
    }
    let decoded: { phone_number?: string; email?: string; email_verified?: boolean };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired verification.');
    }
    const phoneOk = decoded.phone_number === expectedPhone;
    const emailOk =
      !!decoded.email_verified && decoded.email?.toLowerCase() === expectedEmail.toLowerCase();
    if (!phoneOk && !emailOk) {
      throw new BadRequestException('Verification does not match the account.');
    }
  }

  /**
   * Decodes and verifies a social sign-in (Google/Facebook) ID token's
   * signature only — no cross-check against an existing account, since the
   * token's own email claim IS the identity being asserted. Requires
   * `email_verified: true`: a provider that can emit an unverified email
   * claim (Facebook) would otherwise let an attacker log in as an existing
   * account by claiming its email without proving ownership of it.
   */
  async verifySocialToken(idToken: string): Promise<{ email: string; name?: string }> {
    if (!this.app) {
      throw new BadRequestException('Verification is not configured on the server.');
    }
    let decoded: { email?: string; email_verified?: boolean; name?: string };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired verification.');
    }
    if (!decoded.email) {
      throw new BadRequestException('Social sign-in token has no email.');
    }
    if (!decoded.email_verified) {
      throw new BadRequestException('Social sign-in email is not verified.');
    }
    return { email: decoded.email, name: decoded.name };
  }
}
