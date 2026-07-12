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

  // "dev" logs the code (never allowed in production - see refine below);
  // "sms" is the real provider (wire a Twilio/SMS adapter before production).
  OTP_PROVIDER: z.enum(['dev', 'sms']).default('dev'),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MIN: z.coerce.number().int().positive().default(5),
  OTP_SEND_MAX: z.coerce.number().int().positive().default(5),
  OTP_SEND_WINDOW_MIN: z.coerce.number().int().positive().default(15),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  // --- Maps / distance (M2) ---
  // "haversine" needs no API key (dev/default); "google" uses Distance Matrix.
  MAPS_PROVIDER: z.enum(['haversine', 'google']).default('haversine'),
  GOOGLE_MAPS_API_KEY: z.string().default(''),

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
})
  // Production must not run the dev OTP provider (it logs codes to the console).
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production' && val.OTP_PROVIDER === 'dev') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_PROVIDER'],
        message: 'OTP_PROVIDER must not be "dev" when NODE_ENV=production.',
      });
    }
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
