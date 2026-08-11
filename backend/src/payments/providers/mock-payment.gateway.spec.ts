import { Prisma, TransactionStatus } from '@prisma/client';
import { MockPaymentGateway } from './mock-payment.gateway';

describe('MockPaymentGateway', () => {
  function makeGateway(tx: { status: TransactionStatus } | null) {
    const prisma = {
      transaction: { findUnique: jest.fn().mockResolvedValue(tx) },
    };
    return { gateway: new MockPaymentGateway(prisma as never), prisma };
  }

  const input = {
    amount: new Prisma.Decimal('33.66'),
    currency: 'GHS',
    reference: 'KAYA-1-abc',
    customerEmail: 'client.demo@kaya.local',
  };

  describe('initialize', () => {
    it('points at the checkout page this backend serves, on the base URL the device used', async () => {
      const { gateway } = makeGateway(null);
      const init = await gateway.initialize({
        ...input,
        publicBaseUrl: 'http://10.0.2.2:3000',
      });
      // Not a fantasy host: the first version returned https://mock-pay.local,
      // which was a blank tab the first time a phone opened it.
      expect(init.authorizationUrl).toBe(
        'http://10.0.2.2:3000/api/v1/payments/mock/checkout/KAYA-1-abc',
      );
    });

    it('forwards the callback deep link, encoded, as the redirect parameter', async () => {
      const { gateway } = makeGateway(null);
      const init = await gateway.initialize({
        ...input,
        publicBaseUrl: 'http://10.0.2.2:3000',
        callbackUrl: 'kayaclient://payment/return',
      });
      expect(init.authorizationUrl).toBe(
        'http://10.0.2.2:3000/api/v1/payments/mock/checkout/KAYA-1-abc' +
          '?redirect=kayaclient%3A%2F%2Fpayment%2Freturn',
      );
    });

    it('falls back to localhost when no public base URL is known', async () => {
      const { gateway } = makeGateway(null);
      const init = await gateway.initialize(input);
      expect(init.authorizationUrl).toBe(
        'http://localhost:3000/api/v1/payments/mock/checkout/KAYA-1-abc',
      );
    });
  });

  describe('verify', () => {
    it('reports success only once the ledger row is completed', async () => {
      const { gateway } = makeGateway({ status: TransactionStatus.completed });
      await expect(gateway.verify('KAYA-1-abc')).resolves.toMatchObject({ status: 'success' });
    });

    it('reports failed for a payment the user failed on the mock page', async () => {
      // The regression this guards: an unconditional 'success' here let the
      // verify that follows the redirect flip an explicitly failed payment
      // into escrow_held.
      const { gateway } = makeGateway({ status: TransactionStatus.failed });
      await expect(gateway.verify('KAYA-1-abc')).resolves.toMatchObject({ status: 'failed' });
    });

    it('reports pending while the checkout has not been finished', async () => {
      const { gateway } = makeGateway({ status: TransactionStatus.pending });
      await expect(gateway.verify('KAYA-1-abc')).resolves.toMatchObject({ status: 'pending' });
    });

    it('reports pending, not success, for a reference it does not know', async () => {
      const { gateway } = makeGateway(null);
      await expect(gateway.verify('nope')).resolves.toMatchObject({ status: 'pending' });
    });
  });
});
