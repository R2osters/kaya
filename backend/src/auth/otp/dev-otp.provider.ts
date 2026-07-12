import { Injectable, Logger } from '@nestjs/common';
import { OtpDeliveryTarget, OtpProvider } from './otp-provider.interface';

/**
 * Development OTP provider: logs the code to the server console instead of
 * sending an SMS/email. The verify flow accepts the real hashed code, so the
 * printed value is what a tester types back. Never enable in production.
 */
@Injectable()
export class DevOtpProvider implements OtpProvider {
  readonly name = 'dev';
  private readonly logger = new Logger('OTP');

  async send(target: OtpDeliveryTarget, code: string): Promise<void> {
    const to = target.phone ?? target.email ?? 'unknown';
    this.logger.warn(`[DEV OTP] code for ${to} is: ${code}`);
  }
}
