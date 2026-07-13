-- backend/prisma/migrations/20260712000000_drop_otp_codes/migration.sql
-- Firebase Phone Auth replaces the custom OTP flow entirely (see
-- docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
DROP TABLE IF EXISTS "otp_codes";
DROP TYPE IF EXISTS "OtpPurpose";
