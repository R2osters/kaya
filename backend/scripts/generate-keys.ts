/**
 * Generates a development RS256 keypair for JWT signing.
 * Writes PEM files to ./keys (gitignored). Never commit real keys.
 *
 * Usage: npm run generate:keys
 */
import { generateKeyPairSync } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(process.cwd(), 'keys');
const PRIVATE_PATH = join(KEYS_DIR, 'jwt-private.pem');
const PUBLIC_PATH = join(KEYS_DIR, 'jwt-public.pem');

function main(): void {
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  const force = process.argv.includes('--force');
  if (existsSync(PRIVATE_PATH) && !force) {
    // eslint-disable-next-line no-console
    console.log('Keys already exist at ./keys. Use --force to overwrite.');
    return;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  writeFileSync(PRIVATE_PATH, privateKey, { mode: 0o600 });
  writeFileSync(PUBLIC_PATH, publicKey, { mode: 0o644 });

  // eslint-disable-next-line no-console
  console.log(`RS256 keypair written to:\n  ${PRIVATE_PATH}\n  ${PUBLIC_PATH}`);
}

main();
