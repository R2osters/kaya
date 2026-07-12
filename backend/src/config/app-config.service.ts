import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import type { Env } from './env.schema';

/**
 * Typed, convenience wrapper over ConfigService.
 * Resolves JWT keys that may be supplied as a PEM string or a file path.
 */
@Injectable()
export class AppConfigService {
  private readonly jwtPrivateKey: string;
  private readonly jwtPublicKey: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.jwtPrivateKey = this.resolveKey(this.get('JWT_PRIVATE_KEY'));
    this.jwtPublicKey = this.resolveKey(this.get('JWT_PUBLIC_KEY'));
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get jwt() {
    return {
      privateKey: this.jwtPrivateKey,
      publicKey: this.jwtPublicKey,
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
      issuer: this.get('JWT_ISSUER'),
      audience: this.get('JWT_AUDIENCE'),
    };
  }

  /** Accepts either an inline PEM (contains "BEGIN") or a filesystem path. */
  private resolveKey(value: string): string {
    if (value.includes('BEGIN')) {
      return value.replace(/\\n/g, '\n');
    }
    const path = isAbsolute(value) ? value : resolve(process.cwd(), value);
    if (!existsSync(path)) {
      throw new Error(
        `JWT key file not found: ${path}. Run "npm run generate:keys" or set an inline PEM.`,
      );
    }
    return readFileSync(path, 'utf8');
  }
}
