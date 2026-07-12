import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CountryCode, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { localDateInCountry } from '../common/country-timezone';

/**
 * Resets drivers' daily_deliveries at local midnight per country (Africa/Accra,
 * Africa/Lome, Africa/Porto-Novo). Runs every 10 minutes; the last-reset local
 * date is stored in Redis so a restart never double-resets and a date rollover
 * triggers the reset exactly once. The first observed date is only recorded (no
 * reset), so booting mid-day does not wipe today's counters.
 */
@Injectable()
export class CommissionScheduler {
  private readonly logger = new Logger(CommissionScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async resetDailyCounters(now = new Date()): Promise<void> {
    for (const country of Object.values(CountryCode)) {
      try {
        await this.resetCountry(country, now);
      } catch (err) {
        this.logger.warn(`Daily reset failed for ${country}: ${(err as Error).message}`);
      }
    }
  }

  private async resetCountry(country: CountryCode, now: Date): Promise<void> {
    const key = `commission:lastReset:${country}`;
    const today = localDateInCountry(country, now);
    const stored = await this.redis.getValue(key);

    if (stored === today) {
      return;
    }
    if (stored === null) {
      // First observation (or Redis just came up): record, do not reset.
      await this.redis.setValue(key, today);
      return;
    }

    const { count } = await this.prisma.user.updateMany({
      where: {
        countryCode: country,
        role: { in: [Role.livreur, Role.both] },
        dailyDeliveries: { gt: 0 },
      },
      data: { dailyDeliveries: 0 },
    });
    await this.redis.setValue(key, today);
    if (count > 0) {
      this.logger.log(`Reset daily_deliveries for ${count} ${country} driver(s) at local midnight.`);
    }
  }
}
