/**
 * Transaction — ledger row for each deposit or withdrawal attempt.
 *
 * Starts as PENDING, then SUCCESS (balance updated) or FAILED (e.g. insufficient funds).
 * balanceBefore/balanceAfter provide an audit trail; on FAILED, balanceAfter equals balanceBefore.
 */
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { formatDecimal } from '../../common/utils/decimal.util';
import { Wallet } from './wallet.entity';
import { BaseCreatedEntity } from './base.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('transactions')
@Index('idx_transactions_wallet_created', ['walletId', 'createdAt'])
export class Transaction extends BaseCreatedEntity {
  @Index('idx_transactions_wallet_id')
  @Column({ type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  /** Set when status is FAILED; null for PENDING/SUCCESS. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  failureReason: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceBefore: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: string;

  @BeforeInsert()
  beforeInsert(): void {
    this.amount = this.formatDecimal(this.amount);
    this.balanceBefore = this.formatDecimal(this.balanceBefore);
    this.balanceAfter = this.formatDecimal(this.balanceAfter);
  }

  private formatDecimal(value: string | number): string {
    return formatDecimal(value);
  }
}
