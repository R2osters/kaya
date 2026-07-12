import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { AppConfigService } from '../config/app-config.service';

/**
 * Socket.io adapter backed by Redis pub/sub so realtime events fan out across
 * multiple API instances. If Redis is unreachable it falls back to the default
 * in-memory adapter (single instance) instead of failing to boot.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = this.config.get('REDIS_URL');
    const pubClient = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    const subClient = pubClient.duplicate();
    // Prevent ioredis from logging "Unhandled error event" while (dis)connecting.
    pubClient.on('error', () => undefined);
    subClient.on('error', () => undefined);
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.io Redis adapter connected.');
    } catch (err) {
      this.logger.warn(
        `Redis adapter unavailable (${(err as Error).message}); using in-memory adapter.`,
      );
      pubClient.disconnect();
      subClient.disconnect();
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
