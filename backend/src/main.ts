import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { API_PREFIX, API_VERSION, SWAGGER_PATH } from './common/constants';

async function bootstrap(): Promise<void> {
  // rawBody is needed to verify payment webhook signatures (Paystack/Kkiapay).
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(AppConfigService);

  // Security headers.
  app.use(helmet());

  // Socket.io with a Redis adapter (falls back to in-memory if Redis is down).
  const redisIoAdapter = new RedisIoAdapter(app, config);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // CORS: whitelist from env; when empty, reflect no cross-origin (same-origin only).
  const origins = config.corsOrigins;
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });

  // Versioned API prefix.
  app.setGlobalPrefix(API_PREFIX);

  // Strict validation everywhere.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Uniform error envelope.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger / OpenAPI at /docs with bearer auth.
  const appName = config.get('APP_NAME');
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appName} API`)
    .setDescription('Delivery platform API - Milestone 1 (auth foundations).')
    .setVersion(API_VERSION)
    .addBearerAuth()
    .addTag('auth')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('PORT');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`${appName} API listening on http://localhost:${port}/${API_PREFIX} (docs: /${SWAGGER_PATH})`);
}

void bootstrap();
