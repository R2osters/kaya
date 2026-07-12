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
}
