import { Test, TestingModule } from '@nestjs/testing';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../database/entities/transaction.entity';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionsRepository: jest.Mocked<TransactionsRepository>;

  beforeEach(async () => {
    transactionsRepository = {
      createPending: jest.fn(),
      updateOutcome: jest.fn(),
      findByWalletIdPaginated: jest.fn(),
    } as unknown as jest.Mocked<TransactionsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: transactionsRepository },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  it('should delegate pending transaction creation', async () => {
    const pending = { id: 'tx-1' } as Transaction;
    transactionsRepository.createPending.mockResolvedValue(pending);

    const result = await service.recordPending({
      walletId: 'wallet-1',
      type: TransactionType.DEPOSIT,
      amount: '10.00',
      balanceBefore: '0.00',
    });

    expect(result).toBe(pending);
  });

  it('should mark transactions successful', async () => {
    await service.markSuccess('tx-1', '110.00');

    expect(transactionsRepository.updateOutcome).toHaveBeenCalledWith(
      'tx-1',
      TransactionStatus.SUCCESS,
      '110.00',
      null,
      undefined,
    );
  });

  it('should mark transactions failed', async () => {
    await service.markFailed('tx-1', '100.00', 'INSUFFICIENT_BALANCE');

    expect(transactionsRepository.updateOutcome).toHaveBeenCalledWith(
      'tx-1',
      TransactionStatus.FAILED,
      '100.00',
      'INSUFFICIENT_BALANCE',
      undefined,
    );
  });

  it('should list wallet transactions', async () => {
    const tx = {
      id: 'tx-1',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.SUCCESS,
      failureReason: null,
      amount: '10.00',
      balanceBefore: '0.00',
      balanceAfter: '10.00',
      createdAt: new Date('2026-01-01'),
    } as Transaction;
    transactionsRepository.findByWalletIdPaginated.mockResolvedValue({
      items: [tx],
      total: 1,
    });

    const result = await service.listByWallet('wallet-1', 1, 10);

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('tx-1');
  });
});
