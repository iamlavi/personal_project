import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../database/entities/transaction.entity';
import { TransactionsRepository } from './transactions.repository';

describe('TransactionsRepository', () => {
  let repository: TransactionsRepository;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;

  beforeEach(async () => {
    transactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<Transaction>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsRepository,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
      ],
    }).compile();

    repository = module.get(TransactionsRepository);
  });

  it('should create pending transactions on the default repository', async () => {
    const pending = {
      id: 'tx-1',
      status: TransactionStatus.PENDING,
    } as Transaction;
    transactionRepository.create.mockReturnValue(pending);
    transactionRepository.save.mockResolvedValue(pending);

    const result = await repository.createPending({
      walletId: 'wallet-1',
      type: TransactionType.DEPOSIT,
      amount: '10.00',
      balanceBefore: '0.00',
    });

    expect(result).toBe(pending);
    expect(transactionRepository.create).toHaveBeenCalled();
  });

  it('should create pending transactions inside a transaction manager', async () => {
    const pending = { id: 'tx-2' } as Transaction;
    const managerRepo = {
      create: jest.fn().mockReturnValue(pending),
      save: jest.fn().mockResolvedValue(pending),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    } as unknown as EntityManager;

    const result = await repository.createPending(
      {
        walletId: 'wallet-1',
        type: TransactionType.WITHDRAWAL,
        amount: '5.00',
        balanceBefore: '10.00',
      },
      manager,
    );

    expect(result).toBe(pending);
    expect(manager.getRepository).toHaveBeenCalledWith(Transaction);
  });

  it('should update outcomes through the transaction manager when provided', async () => {
    const managerRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    } as unknown as EntityManager;

    await repository.updateOutcome(
      'tx-1',
      TransactionStatus.FAILED,
      '10.00',
      'INSUFFICIENT_BALANCE',
      manager,
    );

    expect(managerRepo.update).toHaveBeenCalledWith(
      { id: 'tx-1' },
      {
        status: TransactionStatus.FAILED,
        balanceAfter: '10.00',
        failureReason: 'INSUFFICIENT_BALANCE',
      },
    );
  });

  it('should update outcomes on the default repository', async () => {
    await repository.updateOutcome(
      'tx-1',
      TransactionStatus.SUCCESS,
      '20.00',
      null,
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(
      { id: 'tx-1' },
      {
        status: TransactionStatus.SUCCESS,
        balanceAfter: '20.00',
        failureReason: null,
      },
    );
  });

  it('should paginate wallet transactions', async () => {
    const items = [{ id: 'tx-1' } as Transaction];
    transactionRepository.findAndCount.mockResolvedValue([items, 1]);

    const result = await repository.findByWalletIdPaginated('wallet-1', 2, 5);

    expect(result).toEqual({ items, total: 1 });
    expect(transactionRepository.findAndCount).toHaveBeenCalledWith({
      where: { walletId: 'wallet-1' },
      order: { createdAt: 'DESC' },
      skip: 5,
      take: 5,
    });
  });
});
