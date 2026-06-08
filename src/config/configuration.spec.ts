import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should apply defaults when env vars are unset', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DB_HOST;
    delete process.env.WALLET_TOKEN_TTL_DAYS;
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;

    const config = configuration();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.database.host).toBe('localhost');
    expect(config.jwt.accessExpiresIn).toBe('15m');
    expect(config.wallet.tokenTtlDays).toBeNull();
    expect(config.throttle.ttl).toBe(60000);
    expect(config.throttle.limit).toBe(100);
  });

  it('should read env overrides', () => {
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'custom_db';
    process.env.WALLET_TOKEN_TTL_DAYS = '90';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.THROTTLE_TTL_MS = '30000';
    process.env.THROTTLE_LIMIT = '50';

    const config = configuration();

    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe('test');
    expect(config.database.host).toBe('db.example.com');
    expect(config.database.port).toBe(5433);
    expect(config.database.name).toBe('custom_db');
    expect(config.jwt.accessExpiresIn).toBe('2h');
    expect(config.wallet.tokenTtlDays).toBe(90);
    expect(config.throttle.ttl).toBe(30000);
    expect(config.throttle.limit).toBe(50);
  });

  it('should use default database port and name when unset', () => {
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;

    const config = configuration();

    expect(config.database.port).toBe(5432);
    expect(config.database.name).toBe('wallet_db');
  });

  it('should prefer JWT_ACCESS_EXPIRES_IN over JWT_EXPIRES_IN', () => {
    process.env.JWT_ACCESS_EXPIRES_IN = '30m';
    process.env.JWT_EXPIRES_IN = '2h';

    expect(configuration().jwt.accessExpiresIn).toBe('30m');
  });
});
