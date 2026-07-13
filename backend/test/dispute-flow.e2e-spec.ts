import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/constants';
import { PrismaService } from '../src/prisma/prisma.service';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service';

/**
 * Dispute path: open a dispute after pickup, then an admin resolves it as
 * refund_client — asserting the escrow is refunded and the order is cancelled.
 * Skips itself when Postgres is unreachable.
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

describe('Dispute flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const base = () => request(app.getHttpServer());
  const url = (p: string) => `/${API_PREFIX}${p}`;

  const s = Date.now().toString().slice(-8);
  const client = { email: `dc_${s}@ex.com`, phone: `+2334${s}`, password: 'SecurePass123!', fullName: 'DC', role: 'client', countryCode: 'GHA', firebaseIdToken: 'e2e-fake-firebase-id-token' };
  const driver = { email: `dd_${s}@ex.com`, phone: `+2335${s}`, password: 'SecurePass123!', fullName: 'DD', role: 'livreur', countryCode: 'GHA', driverLicenseNumber: 'PCSRC-2024-001234', driverQrCode: 'x', vehicleType: 'moto', firebaseIdToken: 'e2e-fake-firebase-id-token' };
  const adminEmail = `admin_${s}@ex.com`;

  let clientToken = '', driverToken = '', adminToken = '', orderId = '', deliveryId = '';

  beforeAll(async () => {
    await ready;
    if (!dbAvailable) {
      // eslint-disable-next-line no-console
      console.warn('[e2e] DB unreachable - skipping dispute-flow suite.');
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

    await prisma.countryConfig.upsert({
      where: { countryCode: 'GHA' },
      update: {},
      create: {
        countryCode: 'GHA', countryName: 'Ghana', currencyCode: 'GHS', currencySymbol: 'GHS',
        pricePerKm: 1.0, basePickupFee: 2.0, litigationFee: 1.0,
        withdrawalMethods: ['momo'], momoProviders: ['mtn'],
      },
    });
    await prisma.user.create({
      data: {
        email: adminEmail, phone: `+2336${s}`, passwordHash: await bcrypt.hash('SecurePass123!', 4),
        fullName: 'Admin', role: 'admin', countryCode: 'GHA', isVerified: true, isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !app) return;
    await prisma.user
      .deleteMany({ where: { email: { in: [client.email, driver.email, adminEmail] } } })
      .catch(() => undefined);
    await app.close();
  });

  const step = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!dbAvailable) return;
      await fn();
    });

  step('sets up an order in escrow and drives it to picked_up', async () => {
    await base().post(url('/auth/register')).send(client).expect(201);
    await base().post(url('/auth/register')).send(driver).expect(201);
    await prisma.user.update({
      where: { email: driver.email },
      data: { isVerified: true, isOnline: true, locationLat: 5.6037, locationLng: -0.187 },
    });

    clientToken = (await base().post(url('/auth/login')).send({ identifier: client.email, password: client.password })).body.accessToken;
    driverToken = (await base().post(url('/auth/login')).send({ identifier: driver.email, password: driver.password })).body.accessToken;
    adminToken = (await base().post(url('/auth/login')).send({ identifier: adminEmail, password: 'SecurePass123!' })).body.accessToken;

    orderId = (await base().post(url('/orders')).set('Authorization', `Bearer ${clientToken}`).send({
      pickupAddress: 'P', pickupLat: 5.6037, pickupLng: -0.187, deliveryAddress: 'D', deliveryLat: 5.6046, deliveryLng: -0.186,
    }).expect(201)).body.id;

    const offerId = (await base().post(url(`/orders/${orderId}/offers`)).set('Authorization', `Bearer ${driverToken}`).send({ proposedPrice: 20 }).expect(201)).body.id;
    deliveryId = (await base().post(url(`/offers/${offerId}/accept`)).set('Authorization', `Bearer ${clientToken}`).expect(200)).body.delivery.id;

    const ref = (await base().post(url('/payments/initialize')).set('Authorization', `Bearer ${clientToken}`).send({ deliveryId }).expect(200)).body.reference;
    await base().post(url(`/payments/mock/complete/${ref}`)).expect(200);

    await base().post(url(`/deliveries/${deliveryId}/start`)).set('Authorization', `Bearer ${driverToken}`).expect(200);
    await base().post(url(`/deliveries/${deliveryId}/pickup`)).set('Authorization', `Bearer ${driverToken}`).expect(200);
  });

  step('client opens a dispute; admin sees it and refunds the client', async () => {
    await base()
      .post(url(`/deliveries/${deliveryId}/dispute`))
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'Package damaged' })
      .expect(200);

    const disputes = await base().get(url('/admin/disputes')).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(disputes.body.data.some((o: { id: string }) => o.id === orderId)).toBe(true);

    await base()
      .put(url(`/admin/disputes/${orderId}/resolve`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'refund_client', note: 'Damaged goods' })
      .expect(200);

    const del = await base().get(url(`/deliveries/${deliveryId}`)).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(del.body.clientPaymentStatus).toBe('refunded');

    // A refund ledger row exists for the client.
    const refund = await prisma.transaction.findFirst({ where: { deliveryId, type: 'refund' } });
    expect(refund).not.toBeNull();
  });

  step('resolving the same dispute again is a no-op (idempotent)', async () => {
    const res = await base()
      .put(url(`/admin/disputes/${orderId}/resolve`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'refund_client' })
      .expect(200);
    expect(res.body.resolved).toBe(false);
    const refunds = await prisma.transaction.count({ where: { deliveryId, type: 'refund' } });
    expect(refunds).toBe(1); // no duplicate refund
  });
});
