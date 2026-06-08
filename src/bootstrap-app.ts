/**
 * Shared Nest HTTP configuration for main.ts and e2e tests.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureHttpApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
