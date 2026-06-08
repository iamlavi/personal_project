/**
 * Application entry point.
 *
 * dotenv override: true ensures .env wins over shell-exported DB_* vars
 * (fixes accidental connection to wrong database during local dev).
 */
import { config } from 'dotenv';

config({ override: true, quiet: true });

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureHttpApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Wallet Backend API')
    .setDescription(
      'A quality wallet service with JWT auth, transaction safety, and pessimistic locking',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application started on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/swagger`);
}

bootstrap();
