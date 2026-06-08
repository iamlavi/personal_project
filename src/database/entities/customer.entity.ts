/**
 * Customer — registered user who owns exactly one wallet.
 *
 * Security notes:
 * - password column uses `select: false`; login must explicitly addSelect it
 * - bcrypt hashing runs in @BeforeInsert/@BeforeUpdate (never store plain text)
 */
import * as bcrypt from 'bcrypt';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  OneToOne,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { BaseEntity } from './base.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  private static readonly SALT_ROUNDS = 12;

  @Index('idx_customers_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToOne(() => Wallet, (wallet) => wallet.customer)
  wallet: Wallet;

  @BeforeInsert()
  async beforeInsert(): Promise<void> {
    this.email = this.email.toLowerCase().trim();
    await this.hashPasswordIfNeeded();
  }

  @BeforeUpdate()
  async beforeUpdate(): Promise<void> {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    await this.hashPasswordIfNeeded();
  }

  async comparePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }

  private async hashPasswordIfNeeded(): Promise<void> {
    if (this.password && !this.isPasswordHashed()) {
      this.password = await bcrypt.hash(this.password, Customer.SALT_ROUNDS);
    }
  }

  private isPasswordHashed(): boolean {
    return this.password.startsWith('$2a$') || this.password.startsWith('$2b$');
  }
}
