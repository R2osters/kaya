import { AppConfigService } from '../../config/app-config.service';
import { PhoneVerifier } from '../phone-verifier.interface';

/**
 * Chooses the verifier every login path rests on.
 *
 * This lives in its own file rather than inside `auth.module.ts` for two
 * reasons. It is the security-relevant decision in this area -- the one line
 * that separates "real proof of possession" from "anyone who knows a phone
 * number" -- so it deserves to be readable on its own. And a test for it must
 * not drag in `FirebaseAdminService`, which pulls the real `firebase-admin`
 * SDK and its ESM dependencies into Jest (the same problem
 * `auth.service.spec.ts` documents and works around with module stubs).
 *
 * It takes the two implementations as plain `PhoneVerifier`s, so nothing here
 * imports a class at all.
 *
 * **The production check throws.** A process that boots with an authentication
 * bypass active and a warning in its log is a process nobody notices; one that
 * refuses to start is a deployment that fails loudly. This mirrors
 * `tools/devFlagGuard`, which refuses to *build* an app carrying SKIP_AUTH
 * against a non-local backend.
 *
 * Anything other than the exact string `mock` selects the real verifier, so an
 * unrecognised or empty value fails closed.
 */
export function selectPhoneVerifier(
  config: AppConfigService,
  firebase: PhoneVerifier,
  mock: PhoneVerifier,
): PhoneVerifier {
  if (config.get('FIREBASE_VERIFIER') !== 'mock') {
    return firebase;
  }

  if (config.isProduction) {
    throw new Error(
      'FIREBASE_VERIFIER=mock is a development-only authentication bypass and cannot run ' +
        'with NODE_ENV=production. Configure FIREBASE_SERVICE_ACCOUNT and remove ' +
        'FIREBASE_VERIFIER, or do not deploy this build.',
    );
  }

  return mock;
}
