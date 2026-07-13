import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/constants';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end happy path: register -> login.
 *
 * Requires a reachable Postgres (DATABASE_URL). We probe the database first;
 * when it is unreachable the whole suite is skipped so `npm test` / this e2e run
 * still passes on a machine without the stack running.
 */

// Real FirebaseAdminService verifies genuine Firebase-signed tokens, which the
// e2e suite doesn't have. Stub it so register() treats the fake token as valid.
const fakeFirebaseAdmin = {
  assertPhoneMatches: async (_idToken: string, _phone: string) => undefined,
};

async function databaseReachable(): Promise<boolean> {
  const probe = new PrismaClient();
  try {
    await probe.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe.$disconnect();
  }
}

// Resolved synchronously below via a top-level await guard.
let dbAvailable = false;

// eslint-disable-next-line @typescript-eslint/no-floating-promises
const ready = databaseReachable().then((v) => {
  dbAvailable = v;
});

describe('Auth (e2e): register -> login', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now().toString().slice(-8);
  const user = {
    email: `e2e_${suffix}@example.com`,
    phone: `+2332${suffix}`,
    password: 'SecurePass123!',
    fullName: 'E2E Test Client',
    role: 'client',
    countryCode: 'GHA',
    city: 'Accra',
    firebaseIdToken: 'e2e-fake-firebase-id-token',
  };

  beforeAll(async () => {
    await ready;
    if (!dbAvailable) {
      // eslint-disable-next-line no-console
      console.warn('[e2e] DATABASE_URL unreachable - skipping auth e2e suite.');
      return;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue(fakeFirebaseAdmin)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    if (!dbAvailable || !app) {
      return;
    }
    // Clean up the row this run created.
    await prisma.user.deleteMany({ where: { email: user.email } }).catch(() => undefined);
    await app.close();
  });

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!dbAvailable) {
        return; // no-op skip when the DB is unavailable
      }
      await fn();
    });

  let accessToken: string;
  let refreshToken: string;

  maybe('registers a new client and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send(user)
      .expect(201);

    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  maybe('logs in with email + password', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ identifier: user.email, password: user.password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  maybe('returns the profile from GET /auth/me with the access token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.isVerified).toBe(true); // set at registration via Firebase phone verification
  });

  maybe('rotates the refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/refresh`)
      .send({ refreshToken })
      .expect(200);
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });
});
