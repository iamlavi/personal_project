/**
 * WalletsService — core wallet business logic.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { ErrorCode } from '../common/constants/error-codes';
import {
  TransactionType,
  TransactionStatus,
} from '../database/entities/transaction.entity';
import {
  InsufficientBalanceException,
  MaximumWalletTokensReachedException,
  UnauthorizedWalletAccessException,
  WalletAlreadyExistsException,
  WalletNotFoundException,
  WalletTokenExpiredException,
  WalletTokenNotFoundException,
} from '../common/exceptions/exceptions';
import {
  MAX_WALLET_TOKENS,
  WALLET_TOKEN_LENGTH,
} from '../common/constants/wallet.constants';
import { Wallet } from '../database/entities/wallet.entity';
import { WalletToken } from '../database/entities/wallet-token.entity';
import {
  addDecimal,
  isGreaterOrEqual,
  subtractDecimal,
  toDecimalString,
} from '../common/utils/decimal.util';
import { WalletDepositedEvent } from '../transactions/events/wallet-deposited.event';
import { WalletTokenCreatedEvent } from '../transactions/events/wallet-token-created.event';
import { WalletWithdrawnEvent } from '../transactions/events/wallet-withdrawn.event';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsRepository } from './wallets.repository';

export interface WalletResponse {
  id: string;
  customerId: string;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTokenResponse {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  failureReason: string | null;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: Date;
}

export interface PaginatedTransactionsResponse {
  items: TransactionResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly walletsRepository: WalletsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWallet(customerId: string): Promise<WalletResponse> {
    const existing = await this.walletsRepository.findByCustomerId(customerId);
    if (existing) {
      throw new WalletAlreadyExistsException();
    }

    const wallet = await this.walletsRepository.createWallet(customerId);
    return this.toWalletResponse(wallet);
  }

  async getWalletByCustomerId(customerId: string): Promise<WalletResponse> {
    const wallet = await this.walletsRepository.findByCustomerId(customerId);
    if (!wallet) {
      throw new WalletNotFoundException();
    }
    return this.toWalletResponse(wallet);
  }

  async createWalletToken(customerId: string): Promise<WalletTokenResponse> {
    const wallet = await this.walletsRepository.findByCustomerId(customerId);
    if (!wallet) {
      throw new WalletNotFoundException();
    }

    const expiresAt = this.resolveTokenExpiry();

    const walletToken = await this.dataSource.transaction(async (manager) => {
      await this.walletsRepository.findByIdWithLock(wallet.id, manager);

      const tokenCount =
        await this.walletsRepository.countActiveTokensByWalletId(
          wallet.id,
          manager,
        );
      if (tokenCount >= MAX_WALLET_TOKENS) {
        throw new MaximumWalletTokensReachedException();
      }

      const token = this.generateUniqueToken();
      return this.walletsRepository.createToken(
        wallet.id,
        token,
        expiresAt,
        manager,
      );
    });

    this.eventEmitter.emit(
      'wallet.token.created',
      new WalletTokenCreatedEvent(
        wallet.id,
        customerId,
        walletToken.id,
        walletToken.expiresAt,
      ),
    );

    return this.toWalletTokenResponse(walletToken);
  }

  async deposit(
    customerId: string,
    walletToken: string,
    amount: number,
  ): Promise<TransactionResponse> {
    return this.executeFinancialOperation(
      customerId,
      walletToken,
      amount,
      TransactionType.DEPOSIT,
    );
  }

  async withdraw(
    customerId: string,
    walletToken: string,
    amount: number,
  ): Promise<TransactionResponse> {
    return this.executeFinancialOperation(
      customerId,
      walletToken,
      amount,
      TransactionType.WITHDRAWAL,
    );
  }

  async getTransactions(
    customerId: string,
    walletToken: string,
    page: number,
    limit: number,
  ): Promise<PaginatedTransactionsResponse> {
    const wallet = await this.resolveAuthorizedWallet(customerId, walletToken);
    const { items, total } = await this.transactionsService.listByWallet(
      wallet.id,
      page,
      limit,
    );

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        failureReason: item.failureReason,
        amount: item.amount,
        balanceBefore: item.balanceBefore,
        balanceAfter: item.balanceAfter,
        createdAt: item.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private async executeFinancialOperation(
    customerId: string,
    walletToken: string,
    amount: number,
    type: TransactionType,
  ): Promise<TransactionResponse> {
    const walletTokenEntity = await this.resolveWalletToken(walletToken);
    this.assertWalletOwnership(walletTokenEntity.wallet, customerId);

    const amountStr = toDecimalString(amount);

    const result = await this.dataSource.transaction(async (manager) => {
      const lockedWallet = await this.walletsRepository.findByIdWithLock(
        walletTokenEntity.walletId,
        manager,
      );

      if (!lockedWallet) {
        throw new WalletNotFoundException();
      }

      const balanceBefore = lockedWallet.balance;

      const pendingTransaction = await this.transactionsService.recordPending(
        {
          walletId: lockedWallet.id,
          type,
          amount: amountStr,
          balanceBefore,
        },
        manager,
      );

      if (type === TransactionType.WITHDRAWAL) {
        if (!isGreaterOrEqual(balanceBefore, amountStr)) {
          await this.transactionsService.markFailed(
            pendingTransaction.id,
            balanceBefore,
            ErrorCode.INSUFFICIENT_BALANCE,
            manager,
          );
          return { outcome: 'failed' as const };
        }
      }

      const balanceAfter =
        type === TransactionType.DEPOSIT
          ? addDecimal(balanceBefore, amountStr)
          : subtractDecimal(balanceBefore, amountStr);

      await this.walletsRepository.updateBalance(
        lockedWallet.id,
        balanceAfter,
        manager,
      );

      await this.transactionsService.markSuccess(
        pendingTransaction.id,
        balanceAfter,
        manager,
      );

      this.emitFinancialEvent(
        type,
        lockedWallet.id,
        customerId,
        pendingTransaction.id,
        amountStr,
        balanceAfter,
      );

      return {
        outcome: 'success' as const,
        response: this.toTransactionResponse({
          ...pendingTransaction,
          status: TransactionStatus.SUCCESS,
          failureReason: null,
          balanceAfter,
        }),
      };
    });

    if (result.outcome === 'failed') {
      throw new InsufficientBalanceException();
    }

    return result.response;
  }

  private emitFinancialEvent(
    type: TransactionType,
    walletId: string,
    customerId: string,
    transactionId: string,
    amount: string,
    balanceAfter: string,
  ): void {
    if (type === TransactionType.DEPOSIT) {
      this.eventEmitter.emit(
        'wallet.deposited',
        new WalletDepositedEvent(
          walletId,
          customerId,
          transactionId,
          amount,
          balanceAfter,
        ),
      );
      return;
    }

    this.eventEmitter.emit(
      'wallet.withdrawn',
      new WalletWithdrawnEvent(
        walletId,
        customerId,
        transactionId,
        amount,
        balanceAfter,
      ),
    );
  }

  private async resolveAuthorizedWallet(
    customerId: string,
    walletToken: string,
  ): Promise<Wallet> {
    const walletTokenEntity = await this.resolveWalletToken(walletToken);
    this.assertWalletOwnership(walletTokenEntity.wallet, customerId);
    return walletTokenEntity.wallet;
  }

  private async resolveWalletToken(walletToken: string): Promise<WalletToken> {
    const inactive =
      await this.walletsRepository.findTokenByValueIncludingInactive(
        walletToken,
      );
    if (!inactive) {
      throw new WalletTokenNotFoundException();
    }
    if (inactive.expiresAt && inactive.expiresAt <= new Date()) {
      throw new WalletTokenExpiredException();
    }
    return inactive;
  }

  private assertWalletOwnership(wallet: Wallet, customerId: string): void {
    if (wallet.customerId !== customerId) {
      throw new UnauthorizedWalletAccessException();
    }
  }

  private resolveTokenExpiry(): Date | null {
    const ttlDays = this.configService.get<number | null>(
      'wallet.tokenTtlDays',
    );
    if (!ttlDays) {
      return null;
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);
    return expiresAt;
  }

  private generateUniqueToken(): string {
    return randomBytes(WALLET_TOKEN_LENGTH).toString('hex');
  }

  private toWalletResponse(wallet: Wallet): WalletResponse {
    return {
      id: wallet.id,
      customerId: wallet.customerId,
      balance: wallet.balance,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private toWalletTokenResponse(token: WalletToken): WalletTokenResponse {
    return {
      id: token.id,
      token: token.token,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
    };
  }

  private toTransactionResponse(transaction: {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    failureReason?: string | null;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    createdAt: Date;
  }): TransactionResponse {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      failureReason: transaction.failureReason ?? null,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      createdAt: transaction.createdAt,
    };
  }
}
