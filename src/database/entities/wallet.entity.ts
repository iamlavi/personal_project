/**
 * Wallet — holds a decimal balance for one customer.
 *
 * balance is stored as decimal(18,2) string. Concurrent updates are serialized
 * at the service layer via pessimistic_write locks, not in this entity.
 */
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Customer } from './customer.entity';
import { formatDecimal } from '../../common/utils/decimal.util';
import { WalletToken } from './wallet-token.entity';
import { Transaction } from './transaction.entity';
import { BaseEntity } from './base.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Index('idx_wallets_customer_id', { unique: true })
  @Column({ type: 'uuid', unique: true })
  customerId: string;

  @OneToOne(() => Customer, (customer) => customer.wallet, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  balance: string;

  @OneToMany(() => WalletToken, (token) => token.wallet)
  tokens: WalletToken[];

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  @BeforeInsert()
  beforeInsert(): void {
    this.balance = this.formatBalance(this.balance ?? '0');
  }

  @BeforeUpdate()
  beforeUpdate(): void {
    if (this.balance !== undefined) {
      this.balance = this.formatBalance(this.balance);
    }
  }

  private formatBalance(value: string | number): string {
    return formatDecimal(value);
  }
}
