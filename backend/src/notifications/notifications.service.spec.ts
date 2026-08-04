import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const push = { send: jest.fn() };

  function makePrisma() {
    return {
      notification: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ fcmToken: 'tok-1' }) },
    };
  }

  function build(prisma = makePrisma()) {
    return {
      prisma,
      service: new NotificationsService(prisma as never, push as never),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notify', () => {
    it('sends the notification type in the FCM data payload', async () => {
      // The client cannot route a tap without this. Every push would arrive
      // indistinguishable from every other, and the app would be left guessing
      // the destination from which id keys happen to be present.
      const { service } = build();

      await service.notify('u1', {
        type: 'offer',
        title: 'Nouvelle offre',
        body: 'Kwame propose 28 GHS',
        data: { orderId: 'o1', offerId: 'of1' },
      });

      expect(push.send).toHaveBeenCalledWith('tok-1', {
        title: 'Nouvelle offre',
        body: 'Kwame propose 28 GHS',
        data: { type: 'offer', orderId: 'o1', offerId: 'of1' },
      });
    });

    it('sends the type even when the notification carries no data of its own', async () => {
      const { service } = build();

      await service.notify('u1', { type: 'system', title: 'Maintenance', body: 'Bientôt' });

      expect(push.send).toHaveBeenCalledWith(
        'tok-1',
        expect.objectContaining({ data: { type: 'system' } }),
      );
    });

    it('stringifies non-string data values, since FCM payloads are string-valued', async () => {
      const { service } = build();

      await service.notify('u1', {
        type: 'delivery',
        title: 'Course acceptée',
        body: '',
        data: { deliveryId: 'd1', step: 2, scheduled: false },
      });

      expect(push.send).toHaveBeenCalledWith(
        'tok-1',
        expect.objectContaining({
          data: { type: 'delivery', deliveryId: 'd1', step: '2', scheduled: 'false' },
        }),
      );
    });

    it("does not let a caller's own data override the real notification type", async () => {
      // input.data is built up by whichever service triggers the
      // notification and is not under this service's control; if it happens
      // to carry its own `type` key, the notification's real type must
      // still win the FCM payload.
      const { service } = build();

      await service.notify('u1', {
        type: 'offer',
        title: 'Nouvelle offre',
        body: 'Kwame propose 28 GHS',
        data: { type: 'not-a-real-type', orderId: 'o1' },
      });

      expect(push.send).toHaveBeenCalledWith(
        'tok-1',
        expect.objectContaining({ data: { type: 'offer', orderId: 'o1' } }),
      );
    });

    it('persists the notification before attempting delivery', async () => {
      const { prisma, service } = build();

      await service.notify('u1', { type: 'payment', title: 'Paiement reçu', body: '50 GHS' });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', type: 'payment', title: 'Paiement reçu' }),
      });
    });

    it('skips delivery when the user has no push token', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ fcmToken: null });
      const { service } = build(prisma);

      await service.notify('u1', { type: 'system', title: 'Salut', body: '' });

      expect(prisma.notification.create).toHaveBeenCalled();
      expect(push.send).not.toHaveBeenCalled();
    });

    it('swallows a push failure, because the stored row is the source of truth', async () => {
      push.send.mockRejectedValue(new Error('FCM unavailable'));
      const { prisma, service } = build();

      await expect(
        service.notify('u1', { type: 'system', title: 'Salut', body: '' }),
      ).resolves.toBeUndefined();
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });
});
