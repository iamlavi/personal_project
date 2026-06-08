/**
 * PostgreSQL connection via TypeORM.
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get<string>('nodeEnv') === 'development';
        const isTest = configService.get<string>('nodeEnv') === 'test';

        return {
          type: 'postgres',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          entities: [
            join(__dirname, 'database', 'entities', '*.entity.{ts,js}'),
          ],
          migrations: [
            join(__dirname, 'database', 'migrations', '[0-9]*-*.{ts,js}'),
          ],
          migrationsRun: !isTest,
          synchronize: false,
          logging: isDev,
          ...(isTest && { extra: { max: 5 } }),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
