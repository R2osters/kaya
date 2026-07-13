import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/constants';
import { PrismaService } from '../src/prisma/prisma.service';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service';

/**
 * Full money path (register -> auction -> escrow -> lifecycle -> settlement ->
 * ratings -> withdrawal). Requires a reachable Postgres; the suite skips itself
 * when the DB is unreachable so `npm run test:e2e` stays green without the stack.
 */

// Real FirebaseAdminService verifies genuine Firebase-signed tokens, which the
// e2e suite doesn't have. Stub it so register() treats the fake token as valid.
const fakeFirebaseAdmin = {
  assertPhoneMatches: async (_idToken: string, _phone: string) => undefined,
};

async function dbReachable(): Promise<boolean> {
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

let dbAvailable = false;
const ready = dbReachable().then((v) => (dbAvailable = v));

describe('Money flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const base = () => request(app.getHttpServer());
  const url = (p: string) => `/${API_PREFIX}${p}`;

  const suffix = Date.now().toString().slice(-8);
  const client = {
    email: `client_${suffix}@example.com`,
    phone: `+2332${suffix}`,
    password: 'SecurePass123!',
    fullName: 'E2E Client',
    role: 'client',
    countryCode: 'GHA',
    firebaseIdToken: 'e2e-fake-firebase-id-token',
  };
  const driver = {
    email: `driver_${suffix}@example.com`,
    phone: `+2333${suffix}`,
    password: 'SecurePass123!',
    fullName: 'E2E Driver',
    role: 'livreur',
    countryCode: 'GHA',
    driverLicenseNumber: 'PCSRC-2024-001234',
    driverQrCode: 'data:image/png;base64,abc',
    vehicleType: 'moto',
    firebaseIdToken: 'e2e-fake-firebase-id-token',
  };

  let clientToken = '';
  let driverToken = '';
  let orderId = '';
  let offerId = '';
  let deliveryId = '';
  let paymentRef = '';

  beforeAll(async () => {
    await ready;
    if (!dbAvailable) {
      // eslint-disable-next-line no-console
      console.warn('[e2e] DB unreachable - skipping money-flow suite.');
      return;
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseAdminService)
      .useValue(fakeFirebaseAdmin)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();

    // Ensure the GHA tariff exists.
    await prisma.countryConfig.upsert({
      where: { countryCode: 'GHA' },
      update: {},
      create: {
        countryCode: 'GHA',
        countryName: 'Ghana',
        currencyCode: 'GHS',
        currencySymbol: 'GHS',
        pricePerKm: 1.0,
        basePickupFee: 2.0,
        litigationFee: 1.0,
        withdrawalMethods: ['momo', 'bank_transfer'],
        momoProviders: ['mtn'],
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !app) return;
    await prisma.user
      .deleteMany({ where: { email: { in: [client.email, driver.email] } } })
      .catch(() => undefined);
    await app.close();
  });

  const step = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!dbAvailable) return;
      await fn();
    });

  step('registers client and driver and logs them in', async () => {
    await base().post(url('/auth/register')).send(client).expect(201);
    await base().post(url('/auth/register')).send(driver).expect(201);

    // Verify + bring the driver online near the pickup (admin/GPS shortcuts).
    await prisma.user.update({
      where: { email: driver.email },
      data: { isVerified: true, isOnline: true, locationLat: 5.6037, locationLng: -0.187 },
    });

    const c = await base().post(url('/auth/login')).send({ identifier: client.email, password: client.password }).expect(200);
    const d = await base().post(url('/auth/login')).send({ identifier: driver.email, password: driver.password }).expect(200);
    clientToken = c.body.accessToken;
    driverToken = d.body.accessToken;
  });

  step('client creates an order that publishes with a min price', async () => {
    const res = await base()
      .post(url('/orders'))
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        pickupAddress: 'Pickup',
        pickupLat: 5.6037,
        pickupLng: -0.187,
        deliveryAddress: 'Dropoff',
        deliveryLat: 5.6046,
        deliveryLng: -0.186,
      })
      .expect(201);
    expect(res.body.status).toBe('published');
    orderId = res.body.id;
  });

  step('driver bids and client accepts, creating a delivery', async () => {
    const offer = await base()
      .post(url(`/orders/${orderId}/offers`))
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ proposedPrice: 20 })
      .expect(201);
    offerId = offer.body.id;

    const accept = await base()
      .post(url(`/offers/${offerId}/accept`))
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    deliveryId = accept.body.delivery.id;
    expect(accept.body.order.status).toBe('accepted');
  });

  step('client pays into escrow (mock gateway)', async () => {
    const init = await base()
      .post(url('/payments/initialize'))
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ deliveryId })
      .expect(200);
    paymentRef = init.body.reference;

    await base().post(url(`/payments/mock/complete/${paymentRef}`)).expect(200);

    const del = await base()
      .get(url(`/deliveries/${deliveryId}`))
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    expect(del.body.clientPaymentStatus).toBe('escrow_held');
  });

  step('driver runs the lifecycle and settlement credits net earnings', async () => {
    for (const stepPath of ['start', 'pickup', 'transit', 'confirm-delivery']) {
      await base()
        .post(url(`/deliveries/${deliveryId}/${stepPath}`))
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
    }

    const bal = await base()
      .get(url('/driver/balance'))
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    // base 20, tier1 20% => commission 4, litigation 1 => net 15.
    expect(bal.body.balance).toBe(15);
  });

  step('both parties rate each other', async () => {
    const clientId = (await prisma.user.findUniqueOrThrow({ where: { email: client.email } })).id;
    const driverId = (await prisma.user.findUniqueOrThrow({ where: { email: driver.email } })).id;

    await base()
      .post(url(`/deliveries/${deliveryId}/rate`))
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toUserId: driverId, score: 5, comment: 'Great' })
      .expect(201);
    await base()
      .post(url(`/deliveries/${deliveryId}/rate`))
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ toUserId: clientId, score: 5 })
      .expect(201);
  });

  step('driver withdraws once, second same-day request is rejected (409)', async () => {
    await base()
      .post(url('/driver/withdraw'))
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ amount: 10, method: 'momo', accountDetails: { phone: driver.phone, provider: 'mtn' } })
      .expect(200);

    await base()
      .post(url('/driver/withdraw'))
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ amount: 1, method: 'momo', accountDetails: { phone: driver.phone, provider: 'mtn' } })
      .expect(409);
  });
});
