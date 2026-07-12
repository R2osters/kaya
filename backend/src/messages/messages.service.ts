import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * REST fallback for delivery chat (§3.6). The primary channel is the Socket.io
 * gateway; these endpoints let clients read history, send when offline from the
 * socket, and mark messages read. Sent messages are also broadcast live.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(deliveryId: string, userId: string): Promise<Message[]> {
    await this.assertParticipant(deliveryId, userId);
    return this.prisma.message.findMany({
      where: { deliveryId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(deliveryId: string, userId: string, dto: SendMessageDto): Promise<Message> {
    if (!dto.messageText && !dto.imageUrl) {
      throw new BadRequestException('A message must have text or an image.');
    }
    const delivery = await this.assertParticipant(deliveryId, userId);
    const receiverId =
      delivery.order.clientId === userId ? delivery.livreurId : delivery.order.clientId;

    const message = await this.prisma.message.create({
      data: {
        deliveryId,
        senderId: userId,
        receiverId,
        messageText: dto.messageText ?? null,
        imageUrl: dto.imageUrl ?? null,
      },
    });

    this.realtime.emitToDelivery(deliveryId, 'chat:message', {
      id: message.id,
      sender_id: message.senderId,
      message_text: message.messageText,
      image_url: message.imageUrl,
      created_at: message.createdAt.toISOString(),
    });
    return message;
  }

  async markRead(messageId: string, userId: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message not found.');
    }
    // Only the recipient can mark a message as read.
    if (message.receiverId !== userId) {
      throw new ForbiddenException('You can only mark your own received messages as read.');
    }
    if (message.isRead) {
      return message;
    }
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  private async assertParticipant(deliveryId: string, userId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { clientId: true } } },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (delivery.livreurId !== userId && delivery.order.clientId !== userId) {
      throw new ForbiddenException('You are not a participant of this delivery.');
    }
    return delivery;
  }
}
