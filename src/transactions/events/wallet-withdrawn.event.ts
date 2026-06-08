import { TransactionType } from '../../database/entities/transaction.entity';

export class WalletWithdrawnEvent {
  constructor(
    readonly walletId: string,
    readonly customerId: string,
    readonly transactionId: string,
    readonly amount: string,
    readonly balanceAfter: string,
    readonly type: TransactionType = TransactionType.WITHDRAWAL,
  ) {}
}
