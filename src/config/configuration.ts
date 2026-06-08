/** Typed config factory loaded by ConfigModule (see app.module.ts). */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'wallet_user',
    password: process.env.DB_PASSWORD ?? 'wallet_password',
    name: process.env.DB_NAME ?? 'wallet_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-use-a-long-random-string',
    accessExpiresIn:
      process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '15m',
  },
  wallet: {
    /** null = tokens never expire; set e.g. 90 for 90-day TTL */
    tokenTtlDays: process.env.WALLET_TOKEN_TTL_DAYS
      ? parseInt(process.env.WALLET_TOKEN_TTL_DAYS, 10)
      : null,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
