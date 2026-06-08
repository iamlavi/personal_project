/**
 * WalletToken — opaque credential used with JWT for deposit/withdraw/history.
 *
 * Opaque credential used with JWT for deposit/withdraw/history.
 * Max 3 active tokens enforced in service (with row lock) and by a PostgreSQL trigger.
 */
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { BaseEntity } from './base.entity';

@Entity('wallet_tokens')
export class WalletToken extends BaseEntity {
  @Index('idx_wallet_tokens_wallet_id')
  @Column({ type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Index('idx_wallet_tokens_token', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  isActive(now: Date = new Date()): boolean {
    if (this.expiresAt && this.expiresAt <= now) {
      return false;
    }
    return true;
  }

  @BeforeInsert()
  beforeInsert(): void {
    this.token = this.token.trim();
  }
}
