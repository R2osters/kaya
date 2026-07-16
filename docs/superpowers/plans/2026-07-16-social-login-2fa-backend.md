# Social Login + 2FA — Backend (Wave 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for mandatory 2FA on password login and Google/Facebook social sign-in/sign-up, without touching any money-path logic or the `NOT NULL` invariants on `User.role`/`countryCode`/`phone`.

**Architecture:** Password login becomes two-step (`POST /auth/login` issues a Redis-backed challenge instead of tokens; `POST /auth/login/verify` redeems it against a Firebase phone-or-email proof). Social sign-in (`POST /auth/social`) logs in existing accounts directly; for brand-new accounts it issues a short-lived signed "social draft" token instead of creating a `User` row (which would need placeholder values for `NOT NULL` columns we don't have yet) — a following wave's registration wizard redeems that token via a normal `POST /auth/register` call.

**Tech Stack:** NestJS 10, Prisma, Redis (`ioredis`), `firebase-admin`, `@nestjs/jwt` (RS256, already configured).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md` — read it if anything here is ambiguous. Also read `docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md` for the existing Firebase Phone Auth patterns this work extends.
- `User.role`, `User.countryCode`, `User.phone` stay `NOT NULL` — do not change them. Money-path code (commission/pricing) reads `countryCode` unconditionally.
- Only `User.passwordHash` becomes nullable in this wave.
- Money/auth paths need tests before merge (`CLAUDE.md`) — every task includes Jest unit tests.
- Code + comments in English.
- This wave is backend-only. No Flutter changes, no Firebase Console changes (Google/Facebook provider activation, Firebase Hosting for deep links) — those belong to Wave 2, tracked separately.
- Each task must leave `npx tsc --noEmit -p .` and `npx jest` clean — the codebase compiles and all tests pass after every single task, not just at the end of the wave.

---

### Task 1: Nullable password hash + password-login becomes a challenge issuer

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260716000000_social_login_2fa/migration.sql`
- Modify: `backend/src/redis/redis.service.ts` (none — already has what's needed, just confirming no change required)
- Modify: `backend/src/auth/auth.service.ts` (`login()`)
- Modify: `backend/src/auth/auth.controller.ts` (`login` route return type — no signature change, just behavior)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Produces: `AuthService.login(dto: LoginDto): Promise<{ challengeId: string }>` — replaces the old token-returning shape. `challengeId` is a random UUID stored in Redis at key `login:challenge:{challengeId}` → `userId`, TTL 300s. Task 3 consumes this key format.

- [ ] **Step 1: Write the failing test**

Replace the entire `describe('login', ...)` block in `backend/src/auth/auth.service.spec.ts` (currently at line 186) with:

```typescript
  describe('login', () => {
    it('issues a challenge for valid credentials (no tokens yet)', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'kofi@example.com',
        role: 'livreur',
        countryCode: 'GHA',
        passwordHash,
        isActive: true,
      });

      const result = await service.login({
        identifier: 'kofi@example.com',
        password: 'SecurePass123!',
      });
      expect(result.challengeId).toEqual(expect.any(String));
      expect(redis.setValueEx).toHaveBeenCalledWith(
        `login:challenge:${result.challengeId}`,
        'u1',
        300,
      );
    });

    it('rejects a wrong password with 401', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash,
        isActive: true,
      });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown account with 401', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'nobody@example.com', password: 'whatever12' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a suspended account', async () => {
      const passwordHash = await bcrypt.hash('SecurePass123!', 4);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', passwordHash, isActive: false });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'SecurePass123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a social-only account (null passwordHash) with 401, not a crash', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash: null,
        isActive: true,
      });
      await expect(
        service.login({ identifier: 'kofi@example.com', password: 'anything1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts -t "login"`
Expected: FAIL — `result.challengeId` is `undefined` (current `login()` returns tokens directly), and the new null-passwordHash test throws a TypeError from `bcrypt.compare(dto.password, null)` rather than a clean `UnauthorizedException`.

- [ ] **Step 3: Update the schema and write the migration**

In `backend/prisma/schema.prisma`, change the `User` model's `passwordHash` field:

```prisma
  passwordHash String?     @map("password_hash")
```

(was `String` — just add the `?`). Add a new field right after `isActive`:

```prisma
  authProvider AuthProvider @default(password) @map("auth_provider")
```

Add a new enum near the other enums (e.g. next to `enum Role`):

```prisma
enum AuthProvider {
  password
  google
  facebook
  apple
}
```

Create the migration file:

```sql
-- backend/prisma/migrations/20260716000000_social_login_2fa/migration.sql
-- Social login (Google/Facebook) accounts have no password. See
-- docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE TYPE "AuthProvider" AS ENUM ('password', 'google', 'facebook', 'apple');

ALTER TABLE "users" ADD COLUMN "auth_provider" "AuthProvider" NOT NULL DEFAULT 'password';
```

- [ ] **Step 4: Rewrite `login()` to issue a challenge instead of tokens**

In `backend/src/auth/auth.service.ts`, add the `randomUUID` import:

```typescript
import { randomUUID } from 'crypto';
```

Replace the `login()` method:

```typescript
  async login(dto: LoginDto): Promise<{ challengeId: string }> {
    const identifier = dto.identifier.trim();
    const idKey = identifier.toLowerCase();

    // Brute-force protection: reject while a failure lock is active.
    await this.assertNotLocked(idKey);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
    });

    // Uniform error to avoid leaking which accounts exist. A social-only
    // account (null passwordHash) also falls into this branch — there is no
    // password to compare against, so it's treated the same as "wrong
    // password" rather than crashing bcrypt.compare with a null argument.
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.recordLoginFailure(idKey);
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    await this.clearLoginFailures(idKey);

    const challengeId = randomUUID();
    await this.redis.setValueEx(`login:challenge:${challengeId}`, user.id, 300);
    return { challengeId };
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts && npx tsc --noEmit -p .`
Expected: All tests pass (5/5 in the `login` describe block), `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260716000000_social_login_2fa backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): make passwordHash nullable, login() issues a 2FA challenge instead of tokens"
```

---

### Task 2: `FirebaseAdminService` — phone-or-email verification + social token decode

**Files:**
- Modify: `backend/src/auth/firebase-admin.service.ts`
- Modify: `backend/src/auth/firebase-admin.service.spec.ts`

**Interfaces:**
- Produces: `FirebaseAdminService.assertPhoneOrEmailMatches(idToken: string, expectedPhone: string, expectedEmail: string): Promise<void>` — resolves if the token's `phone_number` OR `email` claim matches (case-insensitive for email), throws `BadRequestException` otherwise. Task 3 depends on this exact signature.
- Produces: `FirebaseAdminService.verifySocialToken(idToken: string): Promise<{ email: string; name?: string }>` — decodes and verifies signature only, throws `BadRequestException` if invalid/unconfigured, throws `BadRequestException` if the token has no `email` claim. Task 4 depends on this exact signature.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/auth/firebase-admin.service.spec.ts` (inside the existing `describe('FirebaseAdminService', ...)` block, after the existing tests):

```typescript
  describe('assertPhoneOrEmailMatches', () => {
    it('resolves when the phone claim matches', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).resolves.toBeUndefined();
    });

    it('resolves when the email claim matches (case-insensitive)', async () => {
      verifyIdToken.mockResolvedValue({ email: 'Kofi@Example.com' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).resolves.toBeUndefined();
    });

    it('rejects when neither claim matches', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233209999999', email: 'other@example.com' });
      await expect(
        service.assertPhoneOrEmailMatches('token', '+233201234567', 'kofi@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid token', async () => {
      verifyIdToken.mockRejectedValue(new Error('invalid'));
      await expect(
        service.assertPhoneOrEmailMatches('bad-token', '+233201234567', 'kofi@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifySocialToken', () => {
    it('returns the email and name claims for a valid token', async () => {
      verifyIdToken.mockResolvedValue({ email: 'kofi@example.com', name: 'Kofi Mensah' });
      await expect(service.verifySocialToken('token')).resolves.toEqual({
        email: 'kofi@example.com',
        name: 'Kofi Mensah',
      });
    });

    it('rejects a token with no email claim', async () => {
      verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
      await expect(service.verifySocialToken('token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid token', async () => {
      verifyIdToken.mockRejectedValue(new Error('invalid'));
      await expect(service.verifySocialToken('bad-token')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest firebase-admin.service.spec.ts`
Expected: FAIL — `assertPhoneOrEmailMatches`/`verifySocialToken` are not functions.

- [ ] **Step 3: Implement**

In `backend/src/auth/firebase-admin.service.ts`, add these two methods to the class (after `assertPhoneMatches`):

```typescript
  /**
   * Verifies the ID token and asserts it carries either the expected phone or
   * the expected email claim. Used for password-login 2FA, where the user
   * picks SMS or email as the verification channel — the backend accepts
   * whichever proof arrives rather than dictating the channel.
   */
  async assertPhoneOrEmailMatches(
    idToken: string,
    expectedPhone: string,
    expectedEmail: string,
  ): Promise<void> {
    if (!this.app) {
      throw new BadRequestException('Verification is not configured on the server.');
    }
    let decoded: { phone_number?: string; email?: string };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired verification.');
    }
    const phoneOk = decoded.phone_number === expectedPhone;
    const emailOk = decoded.email?.toLowerCase() === expectedEmail.toLowerCase();
    if (!phoneOk && !emailOk) {
      throw new BadRequestException('Verification does not match the account.');
    }
  }

  /**
   * Decodes and verifies a social sign-in (Google/Facebook) ID token's
   * signature only — no cross-check against an existing account, since the
   * token's own email claim IS the identity being asserted.
   */
  async verifySocialToken(idToken: string): Promise<{ email: string; name?: string }> {
    if (!this.app) {
      throw new BadRequestException('Verification is not configured on the server.');
    }
    let decoded: { email?: string; name?: string };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired verification.');
    }
    if (!decoded.email) {
      throw new BadRequestException('Social sign-in token has no email.');
    }
    return { email: decoded.email, name: decoded.name };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest firebase-admin.service.spec.ts && npx tsc --noEmit -p .`
Expected: All tests pass, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/firebase-admin.service.ts backend/src/auth/firebase-admin.service.spec.ts
git commit -m "feat(auth): add phone-or-email 2FA verification and social token decoding"
```

---

### Task 3: Login challenge redemption (`POST /auth/login/verify`)

**Files:**
- Create: `backend/src/auth/dto/login-verify.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (add `verifyLoginChallenge`)
- Modify: `backend/src/auth/auth.controller.ts` (add route)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `login:challenge:{challengeId}` Redis key format from Task 1; `FirebaseAdminService.assertPhoneOrEmailMatches` from Task 2.
- Produces: `AuthService.verifyLoginChallenge(dto: LoginVerifyDto): Promise<{ user: PublicUser } & TokenPair>`.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/auth/auth.service.spec.ts` (after the `login` describe block):

```typescript
  describe('verifyLoginChallenge', () => {
    it('issues tokens when the challenge and Firebase proof are valid', async () => {
      redis.getValue.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        email: 'kofi@example.com',
        isActive: true,
      });
      firebaseAdmin.assertPhoneOrEmailMatches.mockResolvedValue(undefined);

      const result = await service.verifyLoginChallenge({
        challengeId: 'chal-1',
        firebaseIdToken: 'tok',
      } as never);

      expect(firebaseAdmin.assertPhoneOrEmailMatches).toHaveBeenCalledWith(
        'tok',
        '+233201234567',
        'kofi@example.com',
      );
      expect(redis.del).toHaveBeenCalledWith('login:challenge:chal-1');
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects an expired or unknown challenge', async () => {
      redis.getValue.mockResolvedValue(null);
      await expect(
        service.verifyLoginChallenge({ challengeId: 'chal-1', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the Firebase proof does not match', async () => {
      redis.getValue.mockResolvedValue('u1');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        email: 'kofi@example.com',
        isActive: true,
      });
      firebaseAdmin.assertPhoneOrEmailMatches.mockRejectedValue(new BadRequestException('mismatch'));
      await expect(
        service.verifyLoginChallenge({ challengeId: 'chal-1', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
```

Also add `findUnique: jest.fn()` and `del: jest.fn()` to the shared `prisma`/`redis` mocks at the top of the file if they aren't already there (check `createPrismaMock()` and the `redis` mock object — `prisma.user.findUnique` and `redis.del`/`redis.getValue` should already exist from earlier tasks in this codebase's history; add them only if missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts -t "verifyLoginChallenge"`
Expected: FAIL — `service.verifyLoginChallenge is not a function`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/auth/dto/login-verify.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginVerifyDto {
  @ApiProperty({ description: 'challengeId returned by POST /auth/login' })
  @IsString()
  challengeId!: string;

  @ApiProperty({ description: 'Firebase ID token proving the phone or email 2FA channel.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;
}
```

In `backend/src/auth/auth.service.ts`, add the import and method (after `login()`):

```typescript
import { LoginVerifyDto } from './dto/login-verify.dto';
```

```typescript
  async verifyLoginChallenge(dto: LoginVerifyDto): Promise<{ user: PublicUser } & TokenPair> {
    const userId = await this.redis.getValue(`login:challenge:${dto.challengeId}`);
    if (!userId) {
      throw new BadRequestException('Login challenge expired or invalid.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.firebaseAdmin.assertPhoneOrEmailMatches(dto.firebaseIdToken, user.phone, user.email);
    await this.redis.del(`login:challenge:${dto.challengeId}`);

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }
```

In `backend/src/auth/auth.controller.ts`, add the import and route (after the existing `login` route):

```typescript
import { LoginVerifyDto } from './dto/login-verify.dto';
```

```typescript
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete password login by redeeming the 2FA challenge.' })
  verifyLoginChallenge(@Body() dto: LoginVerifyDto) {
    return this.auth.verifyLoginChallenge(dto);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts && npx tsc --noEmit -p .`
Expected: All tests pass, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/dto/login-verify.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add POST /auth/login/verify to redeem the 2FA challenge"
```

---

### Task 4: Social draft tokens + `POST /auth/social`

**Files:**
- Modify: `backend/src/auth/token.service.ts` (add `issueSocialDraftToken`/`verifySocialDraftToken`)
- Modify: `backend/src/auth/token.service.spec.ts`
- Create: `backend/src/auth/dto/social-login.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (add `socialLogin`)
- Modify: `backend/src/auth/auth.controller.ts` (add route)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `FirebaseAdminService.verifySocialToken` from Task 2.
- Produces: `TokenService.issueSocialDraftToken({ email, fullName, provider }): Promise<string>` and `TokenService.verifySocialDraftToken(token: string): Promise<{ email: string; fullName?: string; provider: 'google' | 'facebook' }>` (throws `UnauthorizedException` if malformed/expired/wrong purpose). Task 5 depends on `verifySocialDraftToken`'s exact return shape.
- Produces: `AuthService.socialLogin(dto: SocialLoginDto): Promise<({ user: PublicUser } & TokenPair) | { isNewAccount: true; socialDraftToken: string; email: string; fullName?: string }>`.

- [ ] **Step 1: Write the failing tests for `TokenService`**

Check `backend/src/auth/token.service.spec.ts` exists first (if it doesn't, create it following the pattern of other spec files in this directory — a plain `new TokenService(jwtService, prismaMock, configMock)` construction, `JwtService` from `@nestjs/jwt` can be constructed directly with a test RS256 keypair, or mock `signAsync`/`verifyAsync` — inspect the file first and match its existing setup before adding to it). Add:

```typescript
  describe('issueSocialDraftToken / verifySocialDraftToken', () => {
    it('round-trips the claims', async () => {
      const token = await service.issueSocialDraftToken({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
      const decoded = await service.verifySocialDraftToken(token);
      expect(decoded).toEqual({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
    });

    it('rejects a normal access token presented as a social draft token', async () => {
      const accessToken = await service.issueTokenPair({
        id: 'u1',
        email: 'kofi@example.com',
        role: 'client',
        countryCode: 'GHA',
      } as never);
      await expect(
        service.verifySocialDraftToken(accessToken.accessToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest token.service.spec.ts`
Expected: FAIL — `issueSocialDraftToken`/`verifySocialDraftToken` are not functions.

- [ ] **Step 3: Implement in `TokenService`**

In `backend/src/auth/token.service.ts`, add this type near `TokenPair` and these two methods to the class (after `issueTokenPair`):

```typescript
export interface SocialDraftClaims {
  email: string;
  fullName?: string;
  provider: 'google' | 'facebook';
}
```

```typescript
  /**
   * Short-lived (15 min) signed token proving a Google/Facebook sign-in for
   * an email with no existing account yet. Carries a distinct `purpose`
   * claim so JwtStrategy (which only accepts `type: 'access'`) rejects it if
   * presented as a Bearer token — see backend/src/auth/strategies/jwt.strategy.ts.
   */
  async issueSocialDraftToken(claims: SocialDraftClaims): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, purpose: 'social_draft' },
      { expiresIn: '15m' },
    );
  }

  async verifySocialDraftToken(token: string): Promise<SocialDraftClaims> {
    let payload: SocialDraftClaims & { purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired social sign-in token.');
    }
    if (payload.purpose !== 'social_draft') {
      throw new UnauthorizedException('Invalid token type.');
    }
    return { email: payload.email, fullName: payload.fullName, provider: payload.provider };
  }
```

- [ ] **Step 4: Run test to verify `TokenService` tests pass**

Run: `cd backend && npx jest token.service.spec.ts && npx tsc --noEmit -p .`
Expected: Pass, clean.

- [ ] **Step 5: Write the failing test for `AuthService.socialLogin`**

Add to `backend/src/auth/auth.service.spec.ts`:

```typescript
  describe('socialLogin', () => {
    it('logs in an existing account directly (no draft token)', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'kofi@example.com', name: 'Kofi' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'kofi@example.com',
        isActive: true,
      });

      const result = await service.socialLogin({
        firebaseIdToken: 'tok',
        provider: 'google',
      } as never);

      expect('accessToken' in result && result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects a suspended existing account', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'kofi@example.com' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'kofi@example.com', isActive: false });
      await expect(
        service.socialLogin({ firebaseIdToken: 'tok', provider: 'google' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a social draft token for a brand-new account, no User row created', async () => {
      firebaseAdmin.verifySocialToken.mockResolvedValue({ email: 'new@example.com', name: 'New Person' });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.socialLogin({
        firebaseIdToken: 'tok',
        provider: 'facebook',
      } as never);

      expect(result).toEqual({
        isNewAccount: true,
        socialDraftToken: expect.any(String),
        email: 'new@example.com',
        fullName: 'New Person',
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts -t "socialLogin"`
Expected: FAIL — `service.socialLogin is not a function`.

- [ ] **Step 7: Write minimal implementation**

```typescript
// backend/src/auth/dto/social-login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ description: 'Firebase ID token from a Google/Facebook sign-in.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;

  @ApiProperty({ enum: ['google', 'facebook'] })
  @IsIn(['google', 'facebook'])
  provider!: 'google' | 'facebook';
}
```

In `backend/src/auth/auth.service.ts`, add the import and method (after `verifyLoginChallenge`):

```typescript
import { SocialLoginDto } from './dto/social-login.dto';
```

```typescript
  async socialLogin(
    dto: SocialLoginDto,
  ): Promise<
    | ({ user: PublicUser } & TokenPair)
    | { isNewAccount: true; socialDraftToken: string; email: string; fullName?: string }
  > {
    const { email, name } = await this.firebaseAdmin.verifySocialToken(dto.firebaseIdToken);
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      const socialDraftToken = await this.tokens.issueSocialDraftToken({
        email: email.toLowerCase(),
        fullName: name,
        provider: dto.provider,
      });
      return { isNewAccount: true, socialDraftToken, email: email.toLowerCase(), fullName: name };
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }
```

In `backend/src/auth/auth.controller.ts`, add the import and route:

```typescript
import { SocialLoginDto } from './dto/social-login.dto';
```

```typescript
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in or start sign-up via Google/Facebook.' })
  socialLogin(@Body() dto: SocialLoginDto) {
    return this.auth.socialLogin(dto);
  }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && npx jest && npx tsc --noEmit -p .`
Expected: Full unit suite passes, `tsc` clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/auth/token.service.ts backend/src/auth/token.service.spec.ts backend/src/auth/dto/social-login.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add POST /auth/social for Google/Facebook sign-in with draft-token sign-up"
```

---

### Task 5: `register()` accepts a social draft token in place of a password

**Files:**
- Modify: `backend/src/auth/dto/register.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (`register()`)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `TokenService.verifySocialDraftToken` from Task 4.
- Produces: no new public interface — `register()`'s existing signature and return type (`Promise<{ user: PublicUser } & TokenPair>`) are unchanged; only its internal branching and `RegisterDto`'s validation change.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/auth/auth.service.spec.ts`, inside (or near) the existing `describe('register - Firebase phone verification', ...)` block:

```typescript
  describe('register - social sign-up', () => {
    it('creates a user from a valid social draft token, no password hash', async () => {
      tokens.verifySocialDraftToken.mockResolvedValue({
        email: 'kofi@example.com',
        fullName: 'Kofi Mensah',
        provider: 'google',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', ...data }),
      );

      const dto = {
        email: 'kofi@example.com',
        phone: '+233201234567',
        fullName: 'Kofi Mensah',
        role: 'client',
        countryCode: 'GHA',
        firebaseIdToken: 'phone-proof-token',
        socialDraftToken: 'social-draft-token',
      };

      const result = await service.register(dto as never);

      expect(tokens.verifySocialDraftToken).toHaveBeenCalledWith('social-draft-token');
      expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBeNull();
      expect(prisma.user.create.mock.calls[0][0].data.authProvider).toBe('google');
      expect(result.user.email).toBe('kofi@example.com');
    });

    it('rejects a social draft token whose email does not match the submitted email', async () => {
      tokens.verifySocialDraftToken.mockResolvedValue({
        email: 'someone-else@example.com',
        provider: 'google',
      });
      const dto = {
        email: 'kofi@example.com',
        phone: '+233201234567',
        fullName: 'Kofi Mensah',
        role: 'client',
        countryCode: 'GHA',
        firebaseIdToken: 'phone-proof-token',
        socialDraftToken: 'social-draft-token',
      };
      await expect(service.register(dto as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
```

Also add `verifySocialDraftToken: jest.fn()` to the `tokens` mock object at the top of the spec file (alongside `issueTokenPair`, `rotate`, `revoke`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts -t "social sign-up"`
Expected: FAIL — `dto.socialDraftToken` isn't a recognized `RegisterDto` field yet (whitelist validation isn't exercised by a direct service-level test, but `tokens.verifySocialDraftToken` is never called since `register()` doesn't branch on it yet), and `passwordHash` ends up hashed from `undefined` rather than `null`.

- [ ] **Step 3: Update `RegisterDto`**

In `backend/src/auth/dto/register.dto.ts`, change `password` to optional and add `socialDraftToken`:

```typescript
  @ApiPropertyOptional({ example: 'SecurePass123!', minLength: 8 })
  @ValidateIf((dto: RegisterDto) => !dto.socialDraftToken)
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt hard limit
  password?: string;
```

(replace the existing `@ApiProperty` + `password!: string` field — same position in the file). Add the new field near `firebaseIdToken`:

```typescript
  @ApiPropertyOptional({
    description:
      'Social draft token from POST /auth/social, for a new Google/Facebook sign-up. ' +
      'Mutually exclusive with `password` — exactly one must be present.',
  })
  @ValidateIf((dto: RegisterDto) => !dto.password)
  @IsString()
  socialDraftToken?: string;
```

Add the `ValidateIf` import to the existing `class-validator` import line, and `ApiPropertyOptional` to the `@nestjs/swagger` import line if not already present (both likely already imported for other optional fields in this file — check first, add only what's missing).

- [ ] **Step 4: Update `register()` to branch on the social draft token**

In `backend/src/auth/auth.service.ts`, replace the password-hashing section of `register()`:

```typescript
    await this.firebaseAdmin.assertPhoneMatches(dto.firebaseIdToken, dto.phone);
    await this.assertUnique(dto.email, dto.phone);

    let passwordHash: string | null = null;
    let authProvider: 'password' | 'google' | 'facebook' | 'apple' = 'password';
    if (dto.socialDraftToken) {
      const draft = await this.tokens.verifySocialDraftToken(dto.socialDraftToken);
      if (draft.email.toLowerCase() !== dto.email.toLowerCase()) {
        throw new BadRequestException('Social sign-in email does not match the submitted email.');
      }
      authProvider = draft.provider;
    } else {
      passwordHash = await bcrypt.hash(dto.password!, this.config.get('BCRYPT_ROUNDS'));
    }
```

Then in the `prisma.user.create({ data: {...} })` call immediately below, change `passwordHash,` to `passwordHash,` (unchanged reference, now correctly typed `string | null`) and add `authProvider,` as a new field in that same `data` object.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts && npx tsc --noEmit -p .`
Expected: All tests pass, `tsc` clean.

- [ ] **Step 6: Run the full suite one more time**

Run: `cd backend && npx jest && npx tsc --noEmit -p . && npx prisma validate`
Expected: Full unit suite passes (should be back around 90+ tests given Tasks 1-5 each added several), `tsc` clean, schema valid.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/dto/register.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): register() accepts a social draft token in place of a password"
```
