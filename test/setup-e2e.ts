import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env'), override: true, quiet: true });

process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'wallet_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'wallet_password';
process.env.DB_NAME = 'wallet_db';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.JWT_ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '1h';
process.env.NODE_ENV = 'test';
// Avoid rate-limit flakes when auth + wallet tests run in one suite
process.env.THROTTLE_LIMIT = '10000';

jest.setTimeout(30000);
