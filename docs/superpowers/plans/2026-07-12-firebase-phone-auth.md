# Firebase Phone Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom OTP system (backend-generated codes, `otp_codes` table) with Firebase Phone Auth across registration, a new OTP-based login, and a new password-reset flow, in both Flutter apps and the NestJS backend.

**Architecture:** Firebase's client SDK sends/verifies the SMS and returns a signed ID token proving phone ownership; the app forwards that token to the backend, which verifies it via Firebase Admin SDK and cross-checks the phone claim before doing its own business logic (create user / issue JWT / change password). The old backend-driven send/verify round trip is deleted entirely.

**Tech Stack:** NestJS 10 + Prisma + `firebase-admin` (backend, already a dependency), Flutter + `firebase_core`/`firebase_auth` (new), Riverpod, go_router.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md` — read it if anything here is ambiguous.
- Firebase project `kaya-a24e7` (Spark/free plan) already has both Android apps registered (`com.kaya.kaya_client`, `com.kaya.kaya_driver`), Phone provider enabled, and a whitelisted test number `+233201234567` → code `123456` for dev/manual QA (no real SMS, no billing).
- `google-services.json` is already in place at `apps/client/android/app/google-services.json` and `apps/driver/android/app/google-services.json`.
- Money/auth paths need tests before merge (`ASSISTANT.md`) — every backend task below includes a Jest unit test; the e2e suite is updated in Task 5.
- Code + comments in English; UI strings via the existing hand-written `KayaL10n` (mirrored into both ARB files) — no hardcoded UI text.
- No real device/emulator is attached in this environment. Flutter tasks are verified with `flutter analyze` (and `flutter test` where a plain-Dart-logic test is feasible); actual on-device phone-auth QA against the whitelisted test number is a manual step for the user afterward.
- **Before real (non-mocked) end-to-end testing**, `backend/.env` needs `FIREBASE_SERVICE_ACCOUNT` set to the Firebase project's service-account JSON (Firebase Console → Project settings → Service accounts → Generate new private key). This is a sensitive credential — generate/paste it yourself; every task's automated tests mock `FirebaseAdminService`, so no task below is blocked on it.

---

### Task 1: Backend — `FirebaseAdminService` (ID token verification)

**Files:**
- Create: `backend/src/auth/firebase-admin.service.ts`
- Test: `backend/src/auth/firebase-admin.service.spec.ts`

**Interfaces:**
- Produces: `FirebaseAdminService.assertPhoneMatches(idToken: string, expectedPhone: string): Promise<void>` — resolves silently on match, throws `BadRequestException` otherwise (invalid token, unconfigured Firebase Admin, or phone mismatch). Tasks 2-4 depend on this exact signature.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/auth/firebase-admin.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';

const verifyIdToken = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  cert: jest.fn((c: unknown) => c),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

describe('FirebaseAdminService', () => {
  const config = { get: jest.fn() };
  let service: FirebaseAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(JSON.stringify({ project_id: 'kaya-a24e7' }));
    service = new FirebaseAdminService(config as never);
  });

  it('resolves when the token phone claim matches', async () => {
    verifyIdToken.mockResolvedValue({ phone_number: '+233201234567' });
    await expect(
      service.assertPhoneMatches('token', '+233201234567'),
    ).resolves.toBeUndefined();
  });

  it('rejects when the phone claim does not match', async () => {
    verifyIdToken.mockResolvedValue({ phone_number: '+233209999999' });
    await expect(
      service.assertPhoneMatches('token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid'));
    await expect(
      service.assertPhoneMatches('bad-token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when Firebase Admin failed to initialize', async () => {
    config.get.mockReturnValue('not-json');
    const misconfigured = new FirebaseAdminService(config as never);
    await expect(
      misconfigured.assertPhoneMatches('token', '+233201234567'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest firebase-admin.service.spec.ts`
Expected: FAIL with `Cannot find module './firebase-admin.service'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/auth/firebase-admin.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AppConfigService } from '../config/app-config.service';

/**
 * Verifies Firebase Phone Auth ID tokens (see
 * docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
 * Initializes its own named app ('kaya-auth'), separate from the FCM
 * provider's ('kaya-fcm'), so the two integrations fail independently.
 */
@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger('FirebaseAuth');
  private app: App | null = null;

  constructor(private readonly config: AppConfigService) {
    try {
      const raw = this.config.get('FIREBASE_SERVICE_ACCOUNT');
      const credentials = JSON.parse(raw) as ServiceAccount;
      this.app = initializeApp({ credential: cert(credentials) }, 'kaya-auth');
    } catch (err) {
      this.logger.warn(`Firebase Admin init failed: ${(err as Error).message}`);
      this.app = null;
    }
  }

  /** Verifies the ID token and asserts its phone claim matches `expectedPhone`. */
  async assertPhoneMatches(idToken: string, expectedPhone: string): Promise<void> {
    if (!this.app) {
      throw new BadRequestException('Phone verification is not configured on the server.');
    }
    let decoded: { phone_number?: string };
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException('Invalid or expired phone verification.');
    }
    if (decoded.phone_number !== expectedPhone) {
      throw new BadRequestException('Phone verification does not match the submitted phone number.');
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest firebase-admin.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/firebase-admin.service.ts backend/src/auth/firebase-admin.service.spec.ts
git commit -m "feat(auth): add FirebaseAdminService to verify phone-auth ID tokens"
```

---

### Task 2: Backend — `register()` verifies Firebase phone token

**Files:**
- Modify: `backend/src/auth/dto/register.dto.ts`
- Modify: `backend/src/auth/auth.service.ts:1-82` (imports, constructor, `register()`)
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `FirebaseAdminService.assertPhoneMatches(idToken, phone): Promise<void>` (Task 1).
- Produces: `AuthService` constructor now takes `firebaseAdmin: FirebaseAdminService` in place of `otp: OtpService` (4th positional arg) — Task 5 relies on this when it removes `OtpService` entirely.

- [ ] **Step 1: Write the failing test**

Replace the `otp` mock and add a phone-mismatch case in `backend/src/auth/auth.service.spec.ts`:

```typescript
// In the top-level describe, replace the `otp` mock declaration and its
// beforeEach initialization with a `firebaseAdmin` mock:
  let firebaseAdmin: Mocked<{ assertPhoneMatches: unknown }>;
```

```typescript
  beforeEach(() => {
    prisma = createPrismaMock();
    tokens = {
      issueTokenPair: jest.fn().mockResolvedValue(TOKEN_PAIR),
      rotate: jest.fn().mockResolvedValue(TOKEN_PAIR),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    firebaseAdmin = { assertPhoneMatches: jest.fn().mockResolvedValue(undefined) };
    storage = {
      upload: jest.fn(),
      resolvePhoto: jest.fn().mockImplementation((value: string | null | undefined) =>
        Promise.resolve(value ?? null),
      ),
    };
    redis = {
      getValue: jest.fn().mockResolvedValue(null),
      incrWithTtl: jest.fn().mockResolvedValue(1),
      setValueEx: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as never,
      config as never,
      tokens as never,
      firebaseAdmin as never,
      storage as never,
      redis as never,
    );
  });
```

Add `firebaseIdToken: 'test-firebase-id-token-0000000000'` to `baseDriver` and to the plain-client register fixture in the existing tests. Then add:

```typescript
  describe('register - Firebase phone verification', () => {
    it('rejects when the Firebase token phone does not match the submitted phone', async () => {
      firebaseAdmin.assertPhoneMatches.mockRejectedValue(new BadRequestException('mismatch'));
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.register(baseDriver as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('marks the new user verified once Firebase confirms the phone', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', passwordHash: 'x', ...data }),
      );
      const result = await service.register(baseDriver as never);
      expect(firebaseAdmin.assertPhoneMatches).toHaveBeenCalledWith(
        baseDriver.firebaseIdToken,
        baseDriver.phone,
      );
      expect(prisma.user.create.mock.calls[0][0].data.isVerified).toBe(true);
      expect(result.user.driverLicenseNumber).toBe('PCSRC-2024-001234');
    });
  });
```

Also delete the whole `describe('otp', ...)` block (Task 5 removes `sendOtp`/`verifyOtp` from `AuthService` — no point testing them again here).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: FAIL — `RegisterDto`/`AuthService.register` don't check Firebase yet, `isVerified` not set, and the old `otp` describe block still references a removed mock shape.

- [ ] **Step 3: Write minimal implementation**

`backend/src/auth/dto/register.dto.ts` — add after `password`:

```typescript
  @ApiProperty({
    description: 'Firebase Phone Auth ID token proving ownership of `phone`.',
  })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;
```

(add `MinLength` is already imported; no new import needed.)

`backend/src/auth/auth.service.ts` — swap the OTP import/dependency for Firebase and verify before creating the user:

```typescript
// replace:
import { OtpService } from './otp/otp.service';
// with:
import { FirebaseAdminService } from './firebase-admin.service';
```

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser } & TokenPair> {
    const includesLivreur =
      dto.role === RegisterRole.livreur || dto.role === RegisterRole.both;

    if (includesLivreur) {
      const error = validateDriverFields(dto.countryCode, {
        driverLicenseNumber: dto.driverLicenseNumber,
        driverQrCode: dto.driverQrCode,
      });
      if (error) {
        throw new BadRequestException(error);
      }
    }

    await this.firebaseAdmin.assertPhoneMatches(dto.firebaseIdToken, dto.phone);
    await this.assertUnique(dto.email, dto.phone);

    const passwordHash = await bcrypt.hash(dto.password, this.config.get('BCRYPT_ROUNDS'));

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          fullName: dto.fullName,
          age: dto.age,
          role: dto.role as unknown as Role,
          countryCode: dto.countryCode,
          city: dto.city,
          isVerified: true,
          driverLicenseNumber: includesLivreur ? dto.driverLicenseNumber : null,
          driverQrCode: includesLivreur ? dto.driverQrCode : null,
          vehicleType: includesLivreur ? dto.vehicleType : null,
          vehicleRegistration: includesLivreur ? dto.vehicleRegistration : null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email or phone already registered.');
      }
      throw err;
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }
```

(`OtpPurpose` import, `sendOtp`/`verifyOtp` methods stay for now — Task 5 removes them along with the rest of the OTP stack, so this task's diff doesn't need to touch them.)

`backend/src/auth/auth.module.ts` — swap the provider:

```typescript
// replace:
import { OtpService } from './otp/otp.service';
import { OTP_PROVIDER } from './otp/otp-provider.interface';
import { DevOtpProvider } from './otp/dev-otp.provider';
// with:
import { FirebaseAdminService } from './firebase-admin.service';
```

```typescript
  providers: [
    AuthService,
    TokenService,
    FirebaseAdminService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
```

This temporarily breaks `AuthController`'s `sendOtp`/`verifyOtp` handlers (they still call `this.auth.sendOtp`, which still exists on `AuthService` — untouched in this task) and `OtpModule`'s standalone `OtpService`/`otp/` files still compile on their own; nothing else imports the now-removed `OTP_PROVIDER` binding except the `otp/` files themselves, which Task 5 deletes. Confirm with the typecheck in Step 4.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts && npx tsc --noEmit -p .`
Expected: Jest PASS; `tsc` may report `otp/otp.service.ts` etc. as unused/dangling only if strict unused-import checks are on — if so, ignore for now, Task 5 deletes those files.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/dto/register.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.module.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): verify Firebase phone token on registration instead of custom OTP"
```

---

### Task 3: Backend — OTP-based login (`POST /auth/login/otp`)

**Files:**
- Create: `backend/src/auth/dto/login-otp.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (add `loginWithOtp`)
- Modify: `backend/src/auth/auth.controller.ts` (add route)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `FirebaseAdminService.assertPhoneMatches` (Task 1).
- Produces: `AuthService.loginWithOtp(dto: LoginOtpDto): Promise<{ user: PublicUser } & TokenPair>` — same return shape as `login()`.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/auth/auth.service.spec.ts`:

```typescript
  describe('loginWithOtp', () => {
    it('logs in an active user once Firebase confirms the phone', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        phone: '+233201234567',
        isActive: true,
      });
      const result = await service.loginWithOtp({
        phone: '+233201234567',
        firebaseIdToken: 'tok',
      } as never);
      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    });

    it('rejects an unknown phone number', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.loginWithOtp({ phone: '+233200000000', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a suspended account', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(
        service.loginWithOtp({ phone: '+233201234567', firebaseIdToken: 'tok' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: FAIL — `service.loginWithOtp is not a function`

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/auth/dto/login-otp.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class LoginOtpDto {
  @ApiProperty({ example: '+233201234567', description: 'E.164 phone number' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone!: string;

  @ApiProperty({ description: 'Firebase Phone Auth ID token proving ownership of `phone`.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;
}
```

`backend/src/auth/auth.service.ts` — add the import and method (after `login()`):

```typescript
import { LoginOtpDto } from './dto/login-otp.dto';
```

```typescript
  async loginWithOtp(dto: LoginOtpDto): Promise<{ user: PublicUser } & TokenPair> {
    await this.firebaseAdmin.assertPhoneMatches(dto.firebaseIdToken, dto.phone);

    const user = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended.');
    }

    const pair = await this.tokens.issueTokenPair(user);
    return { user: await this.toPublic(user), ...pair };
  }
```

`backend/src/auth/auth.controller.ts` — add the import and route (after `login()`):

```typescript
import { LoginOtpDto } from './dto/login-otp.dto';
```

```typescript
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in via a Firebase-verified phone code (passwordless).' })
  loginWithOtp(@Body() dto: LoginOtpDto) {
    return this.auth.loginWithOtp(dto);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/dto/login-otp.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add Firebase-verified OTP login endpoint"
```

---

### Task 4: Backend — password reset (`POST /auth/password-reset`)

**Files:**
- Create: `backend/src/auth/dto/password-reset.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (add `resetPassword`)
- Modify: `backend/src/auth/auth.controller.ts` (add route)
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `FirebaseAdminService.assertPhoneMatches` (Task 1).
- Produces: `AuthService.resetPassword(dto: PasswordResetDto): Promise<{ success: boolean }>`.

- [ ] **Step 1: Write the failing test**

```typescript
  describe('resetPassword', () => {
    it('updates the password and revokes existing refresh tokens', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+233201234567' });
      prisma.user.update = jest.fn().mockResolvedValue({});
      prisma.refreshToken = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };

      const result = await service.resetPassword({
        phone: '+233201234567',
        firebaseIdToken: 'tok',
        newPassword: 'NewSecurePass123!',
      } as never);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown phone number', async () => {
      firebaseAdmin.assertPhoneMatches.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          phone: '+233200000000',
          firebaseIdToken: 'tok',
          newPassword: 'NewSecurePass123!',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
```

Note: `createPrismaMock()` (top of the spec file) needs `update` and `refreshToken.updateMany` jest.fn() stubs added so other tests that don't set them still get a callable mock:

```typescript
function createPrismaMock() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: FAIL — `service.resetPassword is not a function`

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/auth/dto/password-reset.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PasswordResetDto {
  @ApiProperty({ example: '+233201234567', description: 'E.164 phone number' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone!: string;

  @ApiProperty({ description: 'Firebase Phone Auth ID token proving ownership of `phone`.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;

  @ApiProperty({ example: 'NewSecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
```

`backend/src/auth/auth.service.ts` — add the import and method:

```typescript
import { PasswordResetDto } from './dto/password-reset.dto';
```

```typescript
  async resetPassword(dto: PasswordResetDto): Promise<{ success: boolean }> {
    await this.firebaseAdmin.assertPhoneMatches(dto.firebaseIdToken, dto.phone);

    const user = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    if (!user) {
      throw new BadRequestException('Invalid request.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.config.get('BCRYPT_ROUNDS'));
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
```

`backend/src/auth/auth.controller.ts` — add the import and route:

```typescript
import { PasswordResetDto } from './dto/password-reset.dto';
```

```typescript
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the account password after Firebase phone verification.' })
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.auth.resetPassword(dto);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/dto/password-reset.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add Firebase-verified password reset endpoint"
```

---

### Task 5: Backend — remove the custom OTP stack

**Files:**
- Delete: `backend/src/auth/otp/` (whole directory: `otp.service.ts`, `otp.service.spec.ts`, `dev-otp.provider.ts`, `otp-provider.interface.ts`)
- Delete: `backend/src/auth/dto/otp.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (remove `sendOtp`/`verifyOtp`, `OtpPurpose` import)
- Modify: `backend/src/auth/auth.controller.ts` (remove the two `/otp/*` routes and their imports)
- Modify: `backend/prisma/schema.prisma` (remove `model OtpCode` and `enum OtpPurpose`)
- Create: `backend/prisma/migrations/20260712000000_drop_otp_codes/migration.sql`
- Modify: `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new — this task only removes dead code now that Tasks 2-4 cover every real `OtpPurpose` use case.

- [ ] **Step 1: Remove the OTP endpoints and service methods**

In `backend/src/auth/auth.service.ts`, delete the `sendOtp`/`verifyOtp` methods and the `OtpPurpose` import (now unused since `register`/`loginWithOtp`/`resetPassword` don't take a `purpose` parameter).

In `backend/src/auth/auth.controller.ts`, delete the `sendOtp`/`verifyOtp` handlers and the `import { OtpSendDto, OtpVerifyDto } from './dto/otp.dto';` line.

- [ ] **Step 2: Delete the OTP files**

```bash
rm -rf backend/src/auth/otp
rm backend/src/auth/dto/otp.dto.ts
```

- [ ] **Step 3: Drop `OtpCode`/`OtpPurpose` from the schema**

In `backend/prisma/schema.prisma`, delete the `enum OtpPurpose { ... }` block and the `model OtpCode { ... }` block (lines ~129 and ~418-431 respectively, per the pre-change file).

Create the migration:

```sql
-- backend/prisma/migrations/20260712000000_drop_otp_codes/migration.sql
-- Firebase Phone Auth replaces the custom OTP flow entirely (see
-- docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
DROP TABLE IF EXISTS "otp_codes";
DROP TYPE IF EXISTS "OtpPurpose";
```

- [ ] **Step 4: Update the e2e suite**

Replace the `OTP_PROVIDER` override and the OTP send/verify test in `backend/test/auth.e2e-spec.ts` with a `FirebaseAdminService` override:

```typescript
// replace the imports:
import { OTP_PROVIDER } from '../src/auth/otp/otp-provider.interface';
// with:
import { FirebaseAdminService } from '../src/auth/firebase-admin.service';
```

```typescript
// replace the capturingOtpProvider block with:
const fakeFirebaseAdmin = {
  assertPhoneMatches: async (_idToken: string, _phone: string) => undefined,
};
```

```typescript
// in beforeAll, replace:
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OTP_PROVIDER)
      .useValue(capturingOtpProvider)
      .compile();
// with:
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue(fakeFirebaseAdmin)
      .compile();
```

```typescript
// replace the register test body's `.send(user)` with a body that includes
// the fake token, and delete the whole 'sends and verifies an OTP for the
// phone' test block entirely:
  maybe('registers a new client and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({ ...user, firebaseIdToken: 'e2e-fake-firebase-id-token' })
      .expect(201);

    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });
```

```typescript
// update the profile test's comment/expectation (isVerified is now set at
// registration time, not by a separate OTP step):
  maybe('returns the profile from GET /auth/me with the access token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.isVerified).toBe(true); // set at registration via Firebase phone verification
  });
```

- [ ] **Step 5: Run everything**

Run: `cd backend && npx jest && npx tsc --noEmit -p . && npx prisma validate`
Expected: All unit tests PASS; `tsc` reports no errors (no more references to the deleted `otp/` module); `prisma validate` confirms the schema is well-formed. (`npx prisma generate` also needs a run so the Prisma client stops exporting `OtpPurpose`/`OtpCode` types — safe without a live DB.)

Run (only if Postgres is reachable): `cd backend && npx prisma migrate deploy && npx jest --config ./test/jest-e2e.json`
Expected: migration applies, e2e suite PASS. If the DB isn't reachable, the e2e suite self-skips (see its `dbAvailable` guard) — that's an acceptable outcome for this task, not a failure.

- [ ] **Step 6: Commit**

```bash
git add -A backend/src/auth backend/prisma backend/test
git commit -m "refactor(auth): remove the custom OTP stack, now fully replaced by Firebase Phone Auth"
```

---

### Task 6: `kaya_core` — Firebase deps + `PhoneAuthService`

**Files:**
- Modify: `packages/kaya_core/pubspec.yaml`
- Create: `packages/kaya_core/lib/src/services/phone_auth_service.dart`
- Modify: `packages/kaya_core/lib/kaya_core.dart` (export)

**Interfaces:**
- Produces: `PhoneAuthService` (abstract interface) and `FirebasePhoneAuthService` (implementation) with:
  - `Future<void> sendCode({required String phone, required void Function(String verificationId) onCodeSent, required void Function(String message) onError})`
  - `Future<String> confirmCode({required String verificationId, required String smsCode})` → returns a Firebase ID token.
  These exact names/signatures are used by Tasks 8, 9, 10, 12, 13, 14.

- [ ] **Step 1: Add the dependencies**

In `packages/kaya_core/pubspec.yaml`, add next to `firebase_messaging`:

```yaml
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.1
```

- [ ] **Step 2: Write the service**

```dart
// packages/kaya_core/lib/src/services/phone_auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';

/// Wraps Firebase Phone Auth's verify/confirm flow so onboarding screens
/// never touch the Firebase SDK directly (see
/// docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
abstract interface class PhoneAuthService {
  /// Starts phone verification for [phone]. Calls [onCodeSent] with a
  /// verification id once the SMS (or the whitelisted dev test number) has
  /// been dispatched, or [onError] with a human-readable message on failure.
  Future<void> sendCode({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onError,
  });

  /// Confirms the code the user typed and returns a Firebase ID token
  /// proving ownership of the phone number passed to [sendCode].
  Future<String> confirmCode({
    required String verificationId,
    required String smsCode,
  });
}

class FirebasePhoneAuthService implements PhoneAuthService {
  FirebasePhoneAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<void> sendCode({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onError,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      timeout: const Duration(seconds: 60),
      // Android auto-retrieval fires this without user input; we still let
      // the code screen drive confirmation explicitly for a uniform flow
      // across Android/iOS/test numbers, so this is intentionally a no-op.
      verificationCompleted: (_) {},
      verificationFailed: (e) => onError(e.message ?? 'Phone verification failed.'),
      codeSent: (verificationId, _) => onCodeSent(verificationId),
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  @override
  Future<String> confirmCode({
    required String verificationId,
    required String smsCode,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    final result = await _auth.signInWithCredential(credential);
    final idToken = await result.user?.getIdToken();
    if (idToken == null) {
      throw StateError('Firebase did not return an ID token.');
    }
    return idToken;
  }
}
```

- [ ] **Step 3: Export it from the package barrel**

In `packages/kaya_core/lib/kaya_core.dart`, add under the `// Services` section:

```dart
export 'src/services/phone_auth_service.dart';
```

- [ ] **Step 4: Verify**

Run: `cd packages/kaya_core && flutter pub get && flutter analyze`
Expected: `pub get` resolves without a version-solving conflict against the existing `firebase_messaging: ^15.0.4`; `flutter analyze` reports no errors in the new file.

- [ ] **Step 5: Commit**

```bash
git add packages/kaya_core/pubspec.yaml packages/kaya_core/pubspec.lock packages/kaya_core/lib/src/services/phone_auth_service.dart packages/kaya_core/lib/kaya_core.dart
git commit -m "feat(kaya_core): add PhoneAuthService wrapping Firebase Phone Auth"
```

---

### Task 7: `apps/client` — wire up Firebase (Gradle + init)

**Files:**
- Modify: `apps/client/android/settings.gradle`
- Modify: `apps/client/android/app/build.gradle`
- Modify: `apps/client/lib/main.dart`
- Modify: `apps/client/pubspec.yaml`

**Interfaces:**
- Consumes: `firebase_core` (Task 6, transitively available; declared directly here too since `main.dart` imports it).

- [ ] **Step 1: Apply the Google Services Gradle plugin**

In `apps/client/android/settings.gradle`, add to the `plugins {}` block:

```groovy
plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.1.0" apply false
    id "org.jetbrains.kotlin.android" version "1.8.22" apply false
    id "com.google.gms.google-services" version "4.4.2" apply false
}
```

In `apps/client/android/app/build.gradle`, add to its `plugins {}` block (after the Flutter Gradle plugin, matching the existing "must be applied after" ordering comment):

```groovy
plugins {
    id "com.android.application"
    id "kotlin-android"
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id "dev.flutter.flutter-gradle-plugin"
    id "com.google.gms.google-services"
}
```

- [ ] **Step 2: Declare `firebase_core` and initialize it**

In `apps/client/pubspec.yaml`, add under `dependencies:`:

```yaml
  firebase_core: ^3.6.0
```

In `apps/client/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:firebase_core/firebase_core.dart';

import 'app.dart';
import 'map/google_map_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  // Load FR/EN date symbols so localized DateFormat (weekday, month) works.
  initializeDateFormatting();
  // Plug google_maps_flutter into the MapView abstraction. It only takes effect
  // when a MAPS_API_KEY dart-define is present; otherwise the stylized fallback
  // stays the default.
  registerGoogleMaps();
  runApp(const ProviderScope(child: KayaClientApp()));
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/client && flutter pub get && flutter analyze`
Expected: `pub get` succeeds; `flutter analyze` reports no errors.

Manual (needs a device/emulator, do this yourself since none is attached here): `flutter run`, confirm the app launches without a "Firebase not initialized" crash.

- [ ] **Step 4: Commit**

```bash
git add apps/client/android/settings.gradle apps/client/android/app/build.gradle apps/client/lib/main.dart apps/client/pubspec.yaml apps/client/pubspec.lock
git commit -m "feat(client): initialize Firebase (Android Gradle plugin + Firebase.initializeApp)"
```

---

### Task 8: `apps/client` — registration OTP screen uses Firebase

**Files:**
- Modify: `apps/client/lib/features/onboarding/otp_screen.dart`
- Modify: `apps/client/lib/features/onboarding/register_screen.dart`
- Modify: `packages/kaya_core/lib/src/api/kaya_api.dart` (remove `sendOtp`/`verifyOtp` from `AuthApi`)

**Interfaces:**
- Consumes: `PhoneAuthService`/`FirebasePhoneAuthService` (Task 6), `AuthController.register(Map<String, dynamic>)` (unchanged signature, existing).

- [ ] **Step 1: Remove the dead OTP REST calls from the API client**

In `packages/kaya_core/lib/src/api/kaya_api.dart`, delete the `sendOtp` and `verifyOtp` methods from `AuthApi` (the backend no longer exposes `/auth/otp/send` or `/auth/otp/verify` as of backend Task 5).

- [ ] **Step 2: Stop pre-sending an OTP from the register screen**

In `apps/client/lib/features/onboarding/register_screen.dart`, replace the `_submit` body's try block (the OTP screen now triggers Firebase's `sendCode` itself on init):

```dart
    try {
      if (!mounted) return;
      context.push('/otp',
          extra: OtpArgs(phone: _phone.text.trim(), registerBody: body));
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
```

(The `_loading`/`_error` `setState` calls stay identical — only the `sendOtp` await and its removal changes; `context.push` no longer waits on a network call, so this becomes effectively synchronous, which is fine.)

- [ ] **Step 3: Rewrite the OTP screen around Firebase**

```dart
// apps/client/lib/features/onboarding/otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

/// Arguments passed to the OTP screen after a successful register form submit.
class OtpArgs {
  const OtpArgs({this.phone, this.email, required this.registerBody});
  final String? phone;
  final String? email;

  /// The full register payload, submitted once Firebase confirms the phone.
  final Map<String, dynamic> registerBody;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs? args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _sendCode();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = widget.args?.phone;
    if (phone == null) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _verifyAndRegister() async {
    final args = widget.args;
    if (args == null || _verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(authControllerProvider.notifier).register({
        ...args.registerBody,
        'firebaseIdToken': idToken,
      });
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authOtpTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 8),
            Text(l10n.authOtpSubtitle, style: AppTypography.bodySecondary),
            const SizedBox(height: 28),
            KayaTextField(
              label: 'Code',
              controller: _code,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              prefixIcon: Icons.sms_outlined,
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: l10n.authVerify,
              loading: _loading || _sending,
              onPressed: (_sending || _verificationId == null) ? null : _verifyAndRegister,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Verify**

Run: `cd apps/client && flutter analyze`
Expected: no errors. (No device attached here, so on-device QA against the `+233201234567` / `123456` test number is a manual follow-up for the user.)

- [ ] **Step 5: Commit**

```bash
git add apps/client/lib/features/onboarding/otp_screen.dart apps/client/lib/features/onboarding/register_screen.dart packages/kaya_core/lib/src/api/kaya_api.dart
git commit -m "feat(client): drive registration phone verification through Firebase"
```

---

### Task 9: `apps/client` — OTP-based login screen

**Files:**
- Create: `apps/client/lib/features/onboarding/login_otp_screen.dart`
- Modify: `apps/client/lib/features/onboarding/login_screen.dart` (add a link)
- Modify: `apps/client/lib/router.dart` (add route)
- Modify: `apps/client/lib/providers/auth_provider.dart` (add `loginWithOtp`)
- Modify: `packages/kaya_core/lib/src/api/kaya_api.dart` (add `AuthApi.loginWithOtp`)
- Modify: `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`, `packages/kaya_core/lib/l10n/app_en.arb`, `packages/kaya_core/lib/l10n/app_fr.arb`

**Interfaces:**
- Consumes: `PhoneAuthService` (Task 6), `AuthApi._postMap` (existing).
- Produces: `AuthController.loginWithOtp(String phone, String firebaseIdToken): Future<void>`.

- [ ] **Step 1: Add the API client method**

In `packages/kaya_core/lib/src/api/kaya_api.dart`, add to `AuthApi` (near `login`):

```dart
  Future<AuthResult> loginWithOtp({
    required String phone,
    required String firebaseIdToken,
  }) async =>
      AuthResult.fromJson(await _api._postMap('/auth/login/otp',
          body: {'phone': phone, 'firebaseIdToken': firebaseIdToken},
          skipAuth: true));
```

- [ ] **Step 2: Add the controller method**

In `apps/client/lib/providers/auth_provider.dart`, add to `AuthController` (near `login`):

```dart
  Future<void> loginWithOtp(String phone, String firebaseIdToken) async {
    final result = await _api.auth.loginWithOtp(phone: phone, firebaseIdToken: firebaseIdToken);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _connectSocket(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }
```

- [ ] **Step 3: Add l10n strings**

In `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`, add next to `authCountry`:

```dart
  String get authLoginOtp => _t('Se connecter par code', 'Log in with a code');
  String get authForgotPassword => _t('Mot de passe oublié ?', 'Forgot password?');
```

In `packages/kaya_core/lib/l10n/app_en.arb` and `app_fr.arb`, add next to `"authCountry"` (English shown; use the French text above for `app_fr.arb`):

```json
  "authLoginOtp": "Log in with a code",
  "authForgotPassword": "Forgot password?",
```

- [ ] **Step 4: Write the login-by-OTP screen**

```dart
// apps/client/lib/features/onboarding/login_otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class LoginOtpScreen extends ConsumerStatefulWidget {
  const LoginOtpScreen({super.key});

  @override
  ConsumerState<LoginOtpScreen> createState() => _LoginOtpScreenState();
}

class _LoginOtpScreenState extends ConsumerState<LoginOtpScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: _phone.text.trim(),
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _verifyAndLogin() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref
          .read(authControllerProvider.notifier)
          .loginWithOtp(_phone.text.trim(), idToken);
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authLoginOtp, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233201234567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null)
              KayaTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                prefixIcon: Icons.sms_outlined,
              ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.authVerify,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _verifyAndLogin,
            ),
          ],
        ),
      ),
    );
  }
}
```

This screen also needs `authSendCode` in `kaya_l10n.dart`/both ARB files:

```dart
  String get authSendCode => _t('Envoyer le code', 'Send code');
```

- [ ] **Step 5: Wire the route and the login-screen link**

In `apps/client/lib/router.dart`:

```dart
import 'features/onboarding/login_otp_screen.dart';
```

```dart
      GoRoute(path: '/login-otp', builder: (_, __) => const LoginOtpScreen()),
```

(add right after the `/otp` route) and extend the `onAuthFlow` check:

```dart
      final onAuthFlow = loc.startsWith('/welcome') ||
          loc.startsWith('/login') ||
          loc.startsWith('/register') ||
          loc.startsWith('/otp') ||
          loc == '/splash';
```

(`loc.startsWith('/login')` already covers `/login-otp` — no change needed there; only the new `GoRoute` is required.)

In `apps/client/lib/features/onboarding/login_screen.dart`, add below the existing "Create account" button:

```dart
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authLoginOtp,
              variant: KayaButtonVariant.secondary,
              onPressed: () => context.push('/login-otp'),
            ),
```

- [ ] **Step 6: Verify**

Run: `cd apps/client && flutter analyze`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client/lib/features/onboarding/login_otp_screen.dart apps/client/lib/features/onboarding/login_screen.dart apps/client/lib/router.dart apps/client/lib/providers/auth_provider.dart packages/kaya_core/lib/src/api/kaya_api.dart packages/kaya_core/lib/src/l10n/kaya_l10n.dart packages/kaya_core/lib/l10n/app_en.arb packages/kaya_core/lib/l10n/app_fr.arb
git commit -m "feat(client): add Firebase-verified OTP login flow"
```

---

### Task 10: `apps/client` — password reset screen

**Files:**
- Create: `apps/client/lib/features/onboarding/password_reset_screen.dart`
- Modify: `apps/client/lib/features/onboarding/login_screen.dart` (add a link)
- Modify: `apps/client/lib/router.dart` (add route)
- Modify: `packages/kaya_core/lib/src/api/kaya_api.dart` (add `AuthApi.resetPassword`)
- Modify: `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`, both ARB files

**Interfaces:**
- Consumes: `PhoneAuthService` (Task 6), `KayaApi.auth.resetPassword` (this task).

- [ ] **Step 1: Add the API client method**

In `packages/kaya_core/lib/src/api/kaya_api.dart`, add to `AuthApi`:

```dart
  Future<void> resetPassword({
    required String phone,
    required String firebaseIdToken,
    required String newPassword,
  }) =>
      _api._postMap('/auth/password-reset',
          body: {
            'phone': phone,
            'firebaseIdToken': firebaseIdToken,
            'newPassword': newPassword,
          },
          skipAuth: true);
```

- [ ] **Step 2: Add l10n strings**

In `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`:

```dart
  String get authResetPasswordTitle => _t('Réinitialiser le mot de passe', 'Reset password');
  String get authNewPassword => _t('Nouveau mot de passe', 'New password');
  String get authResetPasswordSuccess =>
      _t('Mot de passe réinitialisé. Connectez-vous.', 'Password reset. Please sign in.');
```

Mirror these three keys into `app_en.arb` and `app_fr.arb`.

- [ ] **Step 3: Write the screen**

```dart
// apps/client/lib/features/onboarding/password_reset_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class PasswordResetScreen extends ConsumerStatefulWidget {
  const PasswordResetScreen({super.key});

  @override
  ConsumerState<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends ConsumerState<PasswordResetScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: _phone.text.trim(),
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _confirmAndReset() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(kayaApiProvider).auth.resetPassword(
            phone: _phone.text.trim(),
            firebaseIdToken: idToken,
            newPassword: _newPassword.text,
          );
      setState(() => _done = true);
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    if (_done) {
      return Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.authResetPasswordSuccess, style: AppTypography.bodyStrong),
                const SizedBox(height: 24),
                KayaButton(
                  label: l10n.authLogin,
                  onPressed: () => context.go('/login'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authResetPasswordTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233201234567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null) ...[
              KayaTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                prefixIcon: Icons.sms_outlined,
              ),
              const SizedBox(height: 16),
              KayaTextField(
                label: l10n.authNewPassword,
                controller: _newPassword,
                obscureText: true,
                prefixIcon: Icons.lock_outline_rounded,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.actionConfirm,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _confirmAndReset,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Wire the route and the login-screen link**

In `apps/client/lib/router.dart`:

```dart
import 'features/onboarding/password_reset_screen.dart';
```

```dart
      GoRoute(path: '/password-reset', builder: (_, __) => const PasswordResetScreen()),
```

In `apps/client/lib/features/onboarding/login_screen.dart`, add below the password field:

```dart
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push('/password-reset'),
                child: Text(l10n.authForgotPassword),
              ),
            ),
```

- [ ] **Step 5: Verify**

Run: `cd apps/client && flutter analyze`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/lib/features/onboarding/password_reset_screen.dart apps/client/lib/features/onboarding/login_screen.dart apps/client/lib/router.dart packages/kaya_core/lib/src/api/kaya_api.dart packages/kaya_core/lib/src/l10n/kaya_l10n.dart packages/kaya_core/lib/l10n/app_en.arb packages/kaya_core/lib/l10n/app_fr.arb
git commit -m "feat(client): add Firebase-verified password reset flow"
```

---

### Task 11: `apps/driver` — wire up Firebase (Gradle + init)

Mirrors Task 7 exactly, for the driver app.

**Files:**
- Modify: `apps/driver/android/settings.gradle`
- Modify: `apps/driver/android/app/build.gradle`
- Modify: `apps/driver/lib/main.dart`
- Modify: `apps/driver/pubspec.yaml`

- [ ] **Step 1**: In `apps/driver/android/settings.gradle`, add `id "com.google.gms.google-services" version "4.4.2" apply false` to the `plugins {}` block (same as Task 7 Step 1).
- [ ] **Step 2**: In `apps/driver/android/app/build.gradle`, add `id "com.google.gms.google-services"` to its `plugins {}` block after the Flutter Gradle plugin line.
- [ ] **Step 3**: In `apps/driver/pubspec.yaml`, add `firebase_core: ^3.6.0` under `dependencies:`.
- [ ] **Step 4**: In `apps/driver/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:firebase_core/firebase_core.dart';

import 'app.dart';
import 'map/google_map_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  // Load FR/EN date symbols so localized DateFormat (weekday, month) works.
  initializeDateFormatting();
  // Plug google_maps_flutter into the MapView abstraction (used only when a
  // MAPS_API_KEY dart-define is present; stylized fallback stays the default).
  registerGoogleMaps();
  runApp(const ProviderScope(child: KayaDriverApp()));
}
```

- [ ] **Step 5: Verify**

Run: `cd apps/driver && flutter pub get && flutter analyze`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/driver/android/settings.gradle apps/driver/android/app/build.gradle apps/driver/lib/main.dart apps/driver/pubspec.yaml apps/driver/pubspec.lock
git commit -m "feat(driver): initialize Firebase (Android Gradle plugin + Firebase.initializeApp)"
```

---

### Task 12: `apps/driver` — registration OTP screen uses Firebase

Mirrors Task 8, for the driver app. `AuthApi.sendOtp`/`verifyOtp` are already removed package-wide by Task 8 (shared `kaya_core`) — this task only touches the driver app itself.

**Files:**
- Modify: `apps/driver/lib/features/onboarding/otp_screen.dart`
- Modify: `apps/driver/lib/features/onboarding/register_screen.dart`

- [ ] **Step 1: Stop pre-sending an OTP from the register screen**

In `apps/driver/lib/features/onboarding/register_screen.dart`, replace the `_submit` body's try block:

```dart
    try {
      if (!mounted) return;
      context.push('/otp',
          extra: OtpArgs(phone: _phone.text.trim(), registerBody: body));
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
```

- [ ] **Step 2: Rewrite the OTP screen around Firebase**

```dart
// apps/driver/lib/features/onboarding/otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class OtpArgs {
  const OtpArgs({this.phone, this.email, required this.registerBody});
  final String? phone;
  final String? email;
  final Map<String, dynamic> registerBody;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs? args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _sendCode();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = widget.args?.phone;
    if (phone == null) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _verifyAndRegister() async {
    final args = widget.args;
    if (args == null || _verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(authControllerProvider.notifier).register({
        ...args.registerBody,
        'firebaseIdToken': idToken,
      });
      // New drivers land on document verification before the home.
      if (mounted) context.go('/verify-documents');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authOtpTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 8),
            Text(l10n.authOtpSubtitle, style: AppTypography.bodySecondary),
            const SizedBox(height: 28),
            KayaTextField(
              label: 'Code',
              controller: _code,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              prefixIcon: Icons.sms_outlined,
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
                label: l10n.authVerify,
                loading: _loading || _sending,
                onPressed:
                    (_sending || _verificationId == null) ? null : _verifyAndRegister),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/driver && flutter analyze`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/lib/features/onboarding/otp_screen.dart apps/driver/lib/features/onboarding/register_screen.dart
git commit -m "feat(driver): drive registration phone verification through Firebase"
```

---

### Task 13: `apps/driver` — OTP-based login screen

**Files:**
- Create: `apps/driver/lib/features/onboarding/login_otp_screen.dart`
- Modify: `apps/driver/lib/features/onboarding/login_screen.dart`
- Modify: `apps/driver/lib/router.dart`
- Modify: `apps/driver/lib/providers/auth_provider.dart`

**Interfaces:**
- Consumes: `PhoneAuthService` (Task 6), `AuthApi.loginWithOtp` (added package-wide in Task 9).
- Produces: `AuthController.loginWithOtp(String phone, String firebaseIdToken): Future<void>` for this app's provider.

- [ ] **Step 1: Add the controller method**

In `apps/driver/lib/providers/auth_provider.dart`, add to `AuthController` (near `login`) — this file calls `_socket.connect(...)` directly rather than through a `_connectSocket` helper, so match that:

```dart
  Future<void> loginWithOtp(String phone, String firebaseIdToken) async {
    final result = await _api.auth.loginWithOtp(phone: phone, firebaseIdToken: firebaseIdToken);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _socket.connect(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }
```

- [ ] **Step 2: Write the login-by-OTP screen**

```dart
// apps/driver/lib/features/onboarding/login_otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class LoginOtpScreen extends ConsumerStatefulWidget {
  const LoginOtpScreen({super.key});

  @override
  ConsumerState<LoginOtpScreen> createState() => _LoginOtpScreenState();
}

class _LoginOtpScreenState extends ConsumerState<LoginOtpScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: _phone.text.trim(),
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _verifyAndLogin() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref
          .read(authControllerProvider.notifier)
          .loginWithOtp(_phone.text.trim(), idToken);
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authLoginOtp, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233201234567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null)
              KayaTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                prefixIcon: Icons.sms_outlined,
              ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.authVerify,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _verifyAndLogin,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Wire the route and the login-screen link**

Read `apps/driver/lib/features/onboarding/login_screen.dart` first — its layout may not be identical to the client app's. Add the import and route to `apps/driver/lib/router.dart`:

```dart
import 'features/onboarding/login_otp_screen.dart';
```

```dart
      GoRoute(path: '/login-otp', builder: (_, __) => const LoginOtpScreen()),
```

(add it next to the existing `/otp` route). In `apps/driver/lib/features/onboarding/login_screen.dart`, add a secondary button below the existing sign-in/register buttons, following that file's existing button style:

```dart
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authLoginOtp,
              variant: KayaButtonVariant.secondary,
              onPressed: () => context.push('/login-otp'),
            ),
```

- [ ] **Step 4: Verify**

Run: `cd apps/driver && flutter analyze`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/driver/lib/features/onboarding/login_otp_screen.dart apps/driver/lib/features/onboarding/login_screen.dart apps/driver/lib/router.dart apps/driver/lib/providers/auth_provider.dart
git commit -m "feat(driver): add Firebase-verified OTP login flow"
```

---

### Task 14: `apps/driver` — password reset screen

**Files:**
- Create: `apps/driver/lib/features/onboarding/password_reset_screen.dart`
- Modify: `apps/driver/lib/features/onboarding/login_screen.dart`
- Modify: `apps/driver/lib/router.dart`

**Interfaces:**
- Consumes: `PhoneAuthService` (Task 6), `KayaApi.auth.resetPassword` (added package-wide in Task 10).

- [ ] **Step 1: Write the screen**

```dart
// apps/driver/lib/features/onboarding/password_reset_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class PasswordResetScreen extends ConsumerStatefulWidget {
  const PasswordResetScreen({super.key});

  @override
  ConsumerState<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends ConsumerState<PasswordResetScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: _phone.text.trim(),
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _confirmAndReset() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(kayaApiProvider).auth.resetPassword(
            phone: _phone.text.trim(),
            firebaseIdToken: idToken,
            newPassword: _newPassword.text,
          );
      setState(() => _done = true);
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    if (_done) {
      return Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.authResetPasswordSuccess, style: AppTypography.bodyStrong),
                const SizedBox(height: 24),
                KayaButton(
                  label: l10n.authLogin,
                  onPressed: () => context.go('/login'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authResetPasswordTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233201234567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null) ...[
              KayaTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                prefixIcon: Icons.sms_outlined,
              ),
              const SizedBox(height: 16),
              KayaTextField(
                label: l10n.authNewPassword,
                controller: _newPassword,
                obscureText: true,
                prefixIcon: Icons.lock_outline_rounded,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.actionConfirm,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _confirmAndReset,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Wire the route and the login-screen link**

In `apps/driver/lib/router.dart`:

```dart
import 'features/onboarding/password_reset_screen.dart';
```

```dart
      GoRoute(path: '/password-reset', builder: (_, __) => const PasswordResetScreen()),
```

In `apps/driver/lib/features/onboarding/login_screen.dart`, add a "Forgot password?" link below the password field, following that file's existing layout:

```dart
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push('/password-reset'),
                child: Text(l10n.authForgotPassword),
              ),
            ),
```

- [ ] **Step 3: Verify**

Run: `cd apps/driver && flutter analyze`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/lib/features/onboarding/password_reset_screen.dart apps/driver/lib/features/onboarding/login_screen.dart apps/driver/lib/router.dart
git commit -m "feat(driver): add Firebase-verified password reset flow"
```

---

### Task 15: Record the BLUEPRINT deviation

**Files:**
- Modify: `BLUEPRINT.md` (Decisions log section)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add the decision log entry**

Append to the `## Decisions log` section in `BLUEPRINT.md`:

```markdown
- 2026-07-12 — **OTP délivré par Firebase Phone Auth**, plus de code maison (`otp_codes` supprimée). Décision utilisateur, suite à un bug du prefill dev (code factice `123456` vs code réel généré côté backend). Couvre les 4 `OtpPurpose` : `registration`/`phone_verification` (migration du flux existant) et `login`/`password_reset` (features neuves, absentes avant ce jour). Projet Firebase `kaya-a24e7` (Spark/free), test number `+233201234567` → `123456` pour dev. Détails : `docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add BLUEPRINT.md
git commit -m "docs: log the Firebase Phone Auth migration in BLUEPRINT decisions"
```
