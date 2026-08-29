import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveWebOrigins } from './cors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: resolveWebOrigins(process.env.WEB_ORIGIN) });
  const port = Number(process.env.PORT ?? process.env.BFF_PORT ?? 3001);
  const host = process.env.BFF_HOST ?? (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
  await app.listen(port, host);
}

void bootstrap();
