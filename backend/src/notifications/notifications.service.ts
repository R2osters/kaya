import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_PROVIDER, NotificationProvider } from './notification-provider.interface';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Persists a Notification row and delivers a push to the user's device token
 * (via the configured PushProvider). Push failures are swallowed - the stored
 * notification is the source of truth and the app can also poll it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER) private readonly push: NotificationProvider,
  ) {}

  async notify(userId: string, input: NotifyInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken) {
      return;
    }

    try {
      await this.push.send(user.fcmToken, {
        title: input.title,
        body: input.body,
        // `type` travels in the data payload as well as being persisted on the
        // row above. Without it every push arrives at the client indistinguishable
        // from every other, so a tap on "new offer" cannot route to the offers
        // screen — the client would have to guess from which id keys happen to
        // be present, which breaks the moment two notification kinds share one.
        //
        // Spread first, `type` last: a caller-supplied `data` map is
        // arbitrary (built up by whichever service triggers the
        // notification) and must not be able to smuggle its own `type` key
        // in and silently override the notification's real one.
        data: { ...this.stringifyData(input.data), type: input.type },
      });
    } catch (err) {
      this.logger.warn(`Push delivery failed for user ${userId}: ${(err as Error).message}`);
    }
  }

  async notifyMany(userIds: string[], input: NotifyInput): Promise<void> {
    await Promise.all(userIds.map((id) => this.notify(id, input)));
  }

  /** Lists a user's notifications (paginated), newest first. */
  async list(userId: string, opts: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const where = { userId, ...(opts.unreadOnly ? { readAt: null } : {}) };

    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { data, page, limit, total, unread };
  }

  /** Marks one notification read (only the owner's). */
  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }
    if (notif.readAt) {
      return notif;
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  /** Marks all of a user's notifications read. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  /** FCM data payloads must be string-valued. */
  private stringifyData(data?: Record<string, unknown>): Record<string, string> | undefined {
    if (!data) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
    );
  }
}
