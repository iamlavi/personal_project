import { TransactionType } from '../../database/entities/transaction.entity';

export class WalletDepositedEvent {
  constructor(
    readonly walletId: string,
    readonly customerId: string,
    readonly transactionId: string,
    readonly amount: string,
    readonly balanceAfter: string,
    readonly type: TransactionType = TransactionType.DEPOSIT,
  ) {}
}
