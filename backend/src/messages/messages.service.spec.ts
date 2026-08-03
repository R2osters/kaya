import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';

/**
 * The broadcast payload is a wire contract, not an implementation detail: the
 * mobile client filters incoming chat by `delivery_id`, so dropping that key
 * silently kills every live message rather than failing loudly. These tests pin
 * the exact shape.
 */
describe('MessagesService', () => {
  const realtime = {
    emitToUser: jest.fn(),
    emitToDelivery: jest.fn(),
    emitToOrder: jest.fn(),
    emitDeliveryStatus: jest.fn(),
  };

  const createdAt = new Date('2026-08-03T10:44:00.000Z');

  function makePrisma() {
    return {
      delivery: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          livreurId: 'driver-1',
          order: { clientId: 'client-1' },
        }),
      },
      message: {
        create: jest.fn().mockResolvedValue({
          id: 'm1',
          deliveryId: 'd1',
          senderId: 'client-1',
          receiverId: 'driver-1',
          messageText: 'On my way to the pickup.',
          imageUrl: null,
          isRead: false,
          createdAt,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  function build() {
    const prisma = makePrisma();
    const service = new MessagesService(prisma as never, realtime as never);
    return { prisma, service };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('broadcasts the message to the delivery room with delivery_id included', async () => {
      const { service } = build();

      await service.send('d1', 'client-1', { messageText: 'On my way to the pickup.' } as never);

      expect(realtime.emitToDelivery).toHaveBeenCalledTimes(1);
      const [deliveryId, event, payload] = realtime.emitToDelivery.mock.calls[0];
      expect(deliveryId).toBe('d1');
      expect(event).toBe('chat:message');
      expect(payload).toEqual({
        id: 'm1',
        delivery_id: 'd1',
        sender_id: 'client-1',
        message_text: 'On my way to the pickup.',
        image_url: null,
        created_at: '2026-08-03T10:44:00.000Z',
      });
    });

    it('addresses the driver when the client sends, and the client when the driver sends', async () => {
      const { prisma, service } = build();

      await service.send('d1', 'client-1', { messageText: 'hi' } as never);
      expect(prisma.message.create.mock.calls[0][0].data.receiverId).toBe('driver-1');

      await service.send('d1', 'driver-1', { messageText: 'hi back' } as never);
      expect(prisma.message.create.mock.calls[1][0].data.receiverId).toBe('client-1');
    });

    it('rejects a message carrying neither text nor an image', async () => {
      const { service } = build();
      await expect(service.send('d1', 'client-1', {} as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(realtime.emitToDelivery).not.toHaveBeenCalled();
    });

    it('refuses a sender who is not a participant of the delivery', async () => {
      const { service } = build();
      await expect(
        service.send('d1', 'stranger', { messageText: 'hello' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(realtime.emitToDelivery).not.toHaveBeenCalled();
    });

    it('reports an unknown delivery rather than broadcasting into nothing', async () => {
      const { prisma, service } = build();
      prisma.delivery.findUnique.mockResolvedValue(null);

      await expect(
        service.send('nope', 'client-1', { messageText: 'hello' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(realtime.emitToDelivery).not.toHaveBeenCalled();
    });
  });
});
