import { z } from 'zod';

/**
 * Environment schema. Validated once at boot; the app refuses to start on any
 * invalid/missing variable so misconfiguration fails fast and loud.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default('Kaya'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // JWT: value is either a path to a PEM file or an inline PEM (contains "BEGIN").
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().min(1).default('kaya-api'),
  JWT_AUDIENCE: z.string().min(1).default('kaya-app'),

  CORS_ORIGINS: z.string().default(''),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().min(1),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  // --- Maps / distance (M2) ---
  // "haversine" is a straight line inflated by a constant and needs no API key
  // (dev/default); "osrm" is real road distance from a routing server; "google"
  // uses Distance Matrix. Every delivery is priced on distance_km, so this
  // choice is a pricing decision, not an infrastructure one -- see
  // maps/providers/osrm.provider.ts for the measured error the constant carries.
  MAPS_PROVIDER: z.enum(['haversine', 'osrm', 'google']).default('haversine'),
  GOOGLE_MAPS_API_KEY: z.string().default(''),
  // Public demo server by default: keyless, fine for dev, explicitly not for
  // production (no SLA, and its usage policy does not cover a commercial app).
  // Production points this at a self-hosted OSRM built from a Ghana/Togo/Benin
  // OSM extract.
  OSRM_BASE_URL: z.string().default('https://router.project-osrm.org'),

  // --- Geocoding (address type-ahead) ---
  // "photon" is the keyless OSM geocoder built for type-ahead (dev/default,
  // degrades to the static landmark list when unreachable); "static" forces
  // that offline list. Nominatim is deliberately absent: its usage policy
  // forbids auto-complete, which is the only thing this endpoint does.
  GEOCODING_PROVIDER: z.enum(['photon', 'static']).default('photon'),
  PHOTON_BASE_URL: z.string().default('https://photon.komoot.io'),

  // --- Phone / identity verification ---
  // "firebase" (default) verifies real Firebase Phone Auth ID tokens.
  // "mock" accepts a `dev:<phone>` token and is an authentication bypass: the
  // auth module refuses to boot with it under NODE_ENV=production. It exists
  // because phone verification was the only external integration here without
  // a keyless implementation, which left a fresh checkout unable to log in.
  FIREBASE_VERIFIER: z.enum(['firebase', 'mock']).default('firebase'),

  // --- Push notifications (M2) ---
  // FCM service-account JSON (string). When empty, the dev log provider is used.
  FIREBASE_SERVICE_ACCOUNT: z.string().default(''),

  // Offer time-to-live in minutes (reverse-auction bids expire).
  OFFER_TTL_MIN: z.coerce.number().int().positive().default(10),

  // --- Payments (M3) ---
  // Ghana: Paystack. Empty key => keyless mock gateway (dev/demo).
  PAYSTACK_SECRET_KEY: z.string().default(''),
  // Togo/Benin: Kkiapay. Empty private key => keyless mock gateway.
  KKIAPAY_PUBLIC_KEY: z.string().default(''),
  KKIAPAY_PRIVATE_KEY: z.string().default(''),
  KKIAPAY_SECRET: z.string().default(''),
  // Where the hosted checkout returns the client after payment.
  PAYMENT_CALLBACK_URL: z.string().default('http://localhost:3000/payment-callback'),
  // Driver withdrawal fee (fraction), e.g. 0.01 = 1% (MoMo). Also read from
  // country_configs where available; this is the platform default/fallback.
  WITHDRAWAL_FEE_PCT: z.coerce.number().min(0).max(0.5).default(0.01),

  ADMIN_EMAIL: z.string().email().default('admin@kaya.local'),
  ADMIN_PHONE: z.string().min(1).default('+233200000000'),
  ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  // Presigned-URL TTL (seconds) for private storage reads; capped at 15 min.
  S3_PRESIGN_TTL: z.coerce.number().int().positive().max(900).default(900),

  // --- Login brute-force protection (M6) ---
  LOGIN_FAIL_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  LOGIN_BACKOFF_AFTER: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_AFTER: z.coerce.number().int().positive().default(10),
  LOGIN_LOCK_MIN: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used as the `validate` hook for @nestjs/config.
 * Throws an aggregated, readable error when validation fails.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
