-- backend/prisma/migrations/20260716000000_social_login_2fa/migration.sql
-- Social login (Google/Facebook) accounts have no password. See
-- docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE TYPE "AuthProvider" AS ENUM ('password', 'google', 'facebook', 'apple');

ALTER TABLE "users" ADD COLUMN "auth_provider" "AuthProvider" NOT NULL DEFAULT 'password';
