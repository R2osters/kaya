import { z } from "zod";
import { isPlainObject, stringLike, stringLikeOrNull } from "../wire/coerce";
import { type User, userSchema } from "./user";

/**
 * Token pair returned by login, register and refresh. The backend has used both
 * camelCase and snake_case spellings, so accept either.
 */
export const authTokensSchema = z
  .object({
    accessToken: z.unknown(),
    refreshToken: z.unknown(),
    access_token: z.unknown(),
    refresh_token: z.unknown(),
  })
  .transform((t) => ({
    accessToken: String(t.accessToken ?? t.access_token ?? ""),
    refreshToken: String(t.refreshToken ?? t.refresh_token ?? ""),
  }));

export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Login/register response: tokens plus, optionally, the user profile. */
export const authResultSchema = z
  .object({ user: z.unknown() })
  .passthrough()
  .transform((raw) => ({
    tokens: authTokensSchema.parse(raw),
    user: isPlainObject(raw.user) ? userSchema.parse(raw.user) : null,
  }));

export type AuthResult = { tokens: AuthTokens; user: User | null };

/** Response to POST /auth/login: a redeemable 2FA challenge, not tokens. */
export const loginChallengeSchema = z.object({ challengeId: stringLike() });

export type LoginChallenge = z.infer<typeof loginChallengeSchema>;

/**
 * Response to POST /auth/social. Either an existing account logs straight in,
 * or the email has no user row yet and the app must route into the registration
 * wizard with name and email prefilled and locked.
 */
export type SocialLoginOutcome =
  | { kind: "success"; result: AuthResult }
  | {
      kind: "signup_required";
      socialDraftToken: string;
      email: string;
      fullName: string | null;
    };

const socialSignupSchema = z.object({
  socialDraftToken: stringLike(),
  email: stringLike(),
  fullName: stringLikeOrNull(),
});

export function parseSocialLoginOutcome(raw: unknown): SocialLoginOutcome {
  const isNew = isPlainObject(raw) && raw.isNewAccount === true;

  if (isNew) {
    return { kind: "signup_required", ...socialSignupSchema.parse(raw) };
  }
  return { kind: "success", result: authResultSchema.parse(raw) };
}
