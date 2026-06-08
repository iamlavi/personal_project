import { Wallet } from './wallet.entity';

describe('Wallet', () => {
  it('should normalize balance on insert', () => {
    const wallet = Object.assign(new Wallet(), { balance: '10.5' });
    wallet.beforeInsert();

    expect(wallet.balance).toBe('10.50');
  });

  it('should normalize balance on update when present', () => {
    const wallet = Object.assign(new Wallet(), { balance: '10.5' });
    wallet.beforeUpdate();

    expect(wallet.balance).toBe('10.50');
  });
});
