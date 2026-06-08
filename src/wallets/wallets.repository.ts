/**
 * WalletsRepository — persistence for Wallet and WalletToken rows.
 *
 * Financial writes that need concurrency safety use pessimistic locking
 * inside an open transaction (see findByIdWithLock).
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WalletToken } from '../database/entities/wallet-token.entity';
import { Wallet } from '../database/entities/wallet.entity';

@Injectable()
export class WalletsRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletToken)
    private readonly walletTokenRepository: Repository<WalletToken>,
  ) {}

  async findByCustomerId(customerId: string): Promise<Wallet | null> {
    return this.walletRepository.findOne({ where: { customerId } });
  }

  async createWallet(customerId: string): Promise<Wallet> {
    const wallet = this.walletRepository.create({ customerId });
    return this.walletRepository.save(wallet);
  }

  /** SELECT ... FOR UPDATE — blocks concurrent balance changes on this row. */
  async findByIdWithLock(
    walletId: string,
    manager: EntityManager,
  ): Promise<Wallet | null> {
    return manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async updateBalance(
    walletId: string,
    balance: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.update(Wallet, { id: walletId }, { balance });
  }

  async findActiveTokenByValue(token: string): Promise<WalletToken | null> {
    const walletToken = await this.walletTokenRepository.findOne({
      where: { token },
      relations: ['wallet'],
    });

    return walletToken?.isActive() ? walletToken : null;
  }

  async findTokenByValueIncludingInactive(
    token: string,
  ): Promise<WalletToken | null> {
    return this.walletTokenRepository.findOne({
      where: { token },
      relations: ['wallet'],
    });
  }

  async countActiveTokensByWalletId(
    walletId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(WalletToken)
      : this.walletTokenRepository;
    const now = new Date();

    return repo
      .createQueryBuilder('wt')
      .where('wt.walletId = :walletId', { walletId })
      .andWhere('(wt.expiresAt IS NULL OR wt.expiresAt > :now)', { now })
      .getCount();
  }

  async createToken(
    walletId: string,
    token: string,
    expiresAt: Date | null,
    manager?: EntityManager,
  ): Promise<WalletToken> {
    const repo = manager
      ? manager.getRepository(WalletToken)
      : this.walletTokenRepository;

    const walletToken = repo.create({ walletId, token, expiresAt });
    return repo.save(walletToken);
  }
}
