import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { WalletToken } from '../database/entities/wallet-token.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsController } from './wallets.controller';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletToken, Transaction]),
    TransactionsModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsRepository, WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
