import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

/**
 * Shared Redis client. Used for hot driver GPS positions (written every tick
 * instead of hammering Postgres) and available for future caching/queues.
 * Degrades gracefully: if Redis is unreachable the app keeps running and these
 * calls become no-ops.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    try {
      this.client = new Redis(this.config.get('REDIS_URL'), {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(`Redis unavailable: ${(err as Error).message}`);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }

  get isAvailable(): boolean {
    return this.client?.status === 'ready';
  }

  /** Stores a driver's latest position at driver:loc:{id} with a 60s TTL. */
  async setDriverPosition(driverId: string, lat: number, lng: number): Promise<void> {
    if (!this.isAvailable) {
      return;
    }
    const payload = JSON.stringify({ lat, lng, ts: Date.now() });
    await this.client!.set(`driver:loc:${driverId}`, payload, 'EX', 60).catch(() => undefined);
  }

  async getDriverPosition(
    driverId: string,
  ): Promise<{ lat: number; lng: number; ts: number } | null> {
    if (!this.isAvailable) {
      return null;
    }
    const raw = await this.client!.get(`driver:loc:${driverId}`).catch(() => null);
    return raw ? (JSON.parse(raw) as { lat: number; lng: number; ts: number }) : null;
  }

  /** Generic get (null when Redis is unavailable or the key is missing). */
  async getValue(key: string): Promise<string | null> {
    if (!this.isAvailable) {
      return null;
    }
    return this.client!.get(key).catch(() => null);
  }

  /** Generic set (no-op when Redis is unavailable). */
  async setValue(key: string, value: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }
    await this.client!.set(key, value).catch(() => undefined);
  }

  /** Set with a TTL in seconds (no-op when Redis is unavailable). */
  async setValueEx(key: string, value: string, ttlSec: number): Promise<void> {
    if (!this.isAvailable) {
      return;
    }
    await this.client!.set(key, value, 'EX', ttlSec).catch(() => undefined);
  }

  /** Delete a key (no-op when Redis is unavailable). */
  async del(key: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }
    await this.client!.del(key).catch(() => undefined);
  }

  /**
   * Atomically increments a counter and (re)applies a TTL, returning the new
   * count. Returns 0 when Redis is unavailable (caller treats as "no lockout").
   */
  async incrWithTtl(key: string, ttlSec: number): Promise<number> {
    if (!this.isAvailable) {
      return 0;
    }
    try {
      const count = await this.client!.incr(key);
      await this.client!.expire(key, ttlSec);
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Returns true at most once per `windowSec` for a given key - used to throttle
   * expensive work (e.g. flushing GPS to Postgres) without a per-tick DB hit.
   */
  async shouldRun(key: string, windowSec: number): Promise<boolean> {
    if (!this.isAvailable) {
      return true; // no Redis: let the caller decide (falls back to always-run)
    }
    const res = await this.client!.set(`throttle:${key}`, '1', 'EX', windowSec, 'NX').catch(
      () => null,
    );
    return res === 'OK';
  }
}
