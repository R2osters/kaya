import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

/**
 * Runs every minute to (1) publish scheduled orders once their publish window
 * (scheduled_time - buffer) is reached, and (2) send delivery reminders.
 * Guards against overlapping runs when a tick takes longer than the interval.
 */
@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.orders.publishDueScheduledOrders();
      await this.orders.sendDeliveryReminders();
    } catch (err) {
      this.logger.warn(`Scheduler tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
