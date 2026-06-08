/**
 * TransactionsRepository — ledger entries for deposit/withdraw attempts.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../database/entities/transaction.entity';

@Injectable()
export class TransactionsRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async createPending(
    data: {
      walletId: string;
      type: TransactionType;
      amount: string;
      balanceBefore: string;
    },
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepository;

    const transaction = repo.create({
      ...data,
      balanceAfter: data.balanceBefore,
      status: TransactionStatus.PENDING,
    });
    return repo.save(transaction);
  }

  async updateOutcome(
    id: string,
    status: TransactionStatus.SUCCESS | TransactionStatus.FAILED,
    balanceAfter: string,
    failureReason: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepository;

    await repo.update({ id }, { status, balanceAfter, failureReason });
  }

  async findByWalletIdPaginated(
    walletId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Transaction[]; total: number }> {
    const [items, total] = await this.transactionRepository.findAndCount({
      where: { walletId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }
}
