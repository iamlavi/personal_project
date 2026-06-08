import { Customer } from './customer.entity';

describe('Customer', () => {
  it('should normalize email and hash password on insert', async () => {
    const customer = Object.assign(new Customer(), {
      email: '  User@Example.COM  ',
      password: 'SecurePass123!',
      name: 'User',
    });

    await customer.beforeInsert();

    expect(customer.email).toBe('user@example.com');
    expect(customer.password.startsWith('$2')).toBe(true);
  });

  it('should normalize email on update', async () => {
    const customer = Object.assign(new Customer(), {
      email: '  Updated@Example.COM  ',
      password: '$2b$10$abcdefghijklmnopqrstuv', // already hashed
      name: 'User',
    });

    await customer.beforeUpdate();

    expect(customer.email).toBe('updated@example.com');
  });

  it('should compare passwords with bcrypt', async () => {
    const customer = Object.assign(new Customer(), {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'User',
    });
    await customer.beforeInsert();

    await expect(customer.comparePassword('SecurePass123!')).resolves.toBe(
      true,
    );
    await expect(customer.comparePassword('wrong')).resolves.toBe(false);
  });
});
