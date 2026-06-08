/**
 * TransactionsService — ledger read/query operations.
 */
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../database/entities/transaction.entity';
import { TransactionsRepository } from './transactions.repository';

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  failureReason: string | null;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: Date;
}

export interface PaginatedTransactions {
  items: TransactionRecord[];
  total: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async recordPending(
    data: {
      walletId: string;
      type: TransactionType;
      amount: string;
      balanceBefore: string;
    },
    manager?: EntityManager,
  ): Promise<Transaction> {
    return this.transactionsRepository.createPending(data, manager);
  }

  async markSuccess(
    transactionId: string,
    balanceAfter: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.transactionsRepository.updateOutcome(
      transactionId,
      TransactionStatus.SUCCESS,
      balanceAfter,
      null,
      manager,
    );
  }

  async markFailed(
    transactionId: string,
    balanceBefore: string,
    failureReason: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.transactionsRepository.updateOutcome(
      transactionId,
      TransactionStatus.FAILED,
      balanceBefore,
      failureReason,
      manager,
    );
  }

  async listByWallet(
    walletId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedTransactions> {
    const { items, total } =
      await this.transactionsRepository.findByWalletIdPaginated(
        walletId,
        page,
        limit,
      );

    return {
      items: items.map((item) => this.toRecord(item)),
      total,
    };
  }

  toRecord(transaction: Transaction): TransactionRecord {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      failureReason: transaction.failureReason,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      createdAt: transaction.createdAt,
    };
  }
}
