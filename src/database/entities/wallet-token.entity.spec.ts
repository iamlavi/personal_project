import { WalletToken } from './wallet-token.entity';

describe('WalletToken', () => {
  const baseToken = (): WalletToken =>
    Object.assign(new WalletToken(), {
      token: 'abc123',
      expiresAt: null,
    });

  it('should be active when not expired', () => {
    expect(baseToken().isActive()).toBe(true);
  });

  it('should be inactive when expired', () => {
    const token = baseToken();
    token.expiresAt = new Date('2020-01-01');

    expect(token.isActive(new Date('2026-01-01'))).toBe(false);
  });

  it('should trim token on insert', () => {
    const token = baseToken();
    token.token = '  spaced-token  ';
    token.beforeInsert();

    expect(token.token).toBe('spaced-token');
  });
});
