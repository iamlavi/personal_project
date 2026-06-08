/**
 * Standalone TypeORM DataSource for CLI migrations (`yarn migration:run`).
 * Not used at runtime — DatabaseModule configures the live connection.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

config({ override: true, quiet: true });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'wallet_user',
  password: process.env.DB_PASSWORD ?? 'wallet_password',
  database: process.env.DB_NAME ?? 'wallet_db',
  entities: [join(__dirname, '../database/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, '../database/migrations/[0-9]*-*.{ts,js}')],
});
