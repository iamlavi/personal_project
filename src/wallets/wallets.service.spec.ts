import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { ErrorCode } from '../common/constants/error-codes';
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
  TransactionStatus,
  TransactionType,
} from '../database/entities/transaction.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { WalletToken } from '../database/entities/wallet-token.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletsRepository: jest.Mocked<WalletsRepository>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  const customerId = '11111111-1111-1111-1111-111111111111';
  const otherCustomerId = '22222222-2222-2222-2222-222222222222';
  const walletId = '33333333-3333-3333-3333-333333333333';

  const mockWallet: Wallet = {
    id: walletId,
    customerId,
    balance: '100.00',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  } as Wallet;

  const mockWalletToken: WalletToken = {
    id: '44444444-4444-4444-4444-444444444444',
    walletId,
    token: 'abc123wallettoken',
    wallet: mockWallet,
    expiresAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  } as WalletToken;

  beforeEach(async () => {
    walletsRepository = {
      findByCustomerId: jest.fn(),
      createWallet: jest.fn(),
      findByIdWithLock: jest.fn(),
      countActiveTokensByWalletId: jest.fn(),
      createToken: jest.fn(),
      updateBalance: jest.fn(),
      findTokenByValueIncludingInactive: jest.fn(),
    } as unknown as jest.Mocked<WalletsRepository>;

    transactionsService = {
      recordPending: jest.fn(),
      markSuccess: jest.fn(),
      markFailed: jest.fn(),
      listByWallet: jest.fn(),
    } as unknown as jest.Mocked<TransactionsService>;

    dataSource = {
      transaction: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: WalletsRepository, useValue: walletsRepository },
        { provide: TransactionsService, useValue: transactionsService },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
            getOrThrow: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(WalletsService);
  });

  describe('createWallet', () => {
    it('should create a wallet when none exists', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(null);
      walletsRepository.createWallet.mockResolvedValue(mockWallet);

      const result = await service.createWallet(customerId);

      expect(result.balance).toBe('100.00');
      expect(result.customerId).toBe(customerId);
      expect(walletsRepository.createWallet).toHaveBeenCalledWith(customerId);
    });

    it('should reject duplicate wallet creation', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(mockWallet);

      await expect(service.createWallet(customerId)).rejects.toThrow(
        WalletAlreadyExistsException,
      );
    });
  });

  describe('getWalletByCustomerId', () => {
    it('should return wallet when it exists', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(mockWallet);

      const result = await service.getWalletByCustomerId(customerId);

      expect(result.id).toBe(walletId);
      expect(result.balance).toBe('100.00');
    });

    it('should throw when wallet is missing', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(null);

      await expect(service.getWalletByCustomerId(customerId)).rejects.toThrow(
        WalletNotFoundException,
      );
    });
  });

  describe('createWalletToken', () => {
    it('should create a wallet token with expiry when configured', async () => {
      const configService = service['configService'] as ConfigService;
      (configService.get as jest.Mock).mockReturnValue(30);
      walletsRepository.findByCustomerId.mockResolvedValue(mockWallet);
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      walletsRepository.countActiveTokensByWalletId.mockResolvedValue(0);
      walletsRepository.createToken.mockResolvedValue(mockWalletToken);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      await service.createWalletToken(customerId);

      expect(walletsRepository.createToken).toHaveBeenCalledWith(
        walletId,
        expect.any(String),
        expect.any(Date),
        expect.anything(),
      );
    });

    it('should create a wallet token', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(mockWallet);
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      walletsRepository.countActiveTokensByWalletId.mockResolvedValue(0);
      walletsRepository.createToken.mockResolvedValue(mockWalletToken);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      const result = await service.createWalletToken(customerId);

      expect(result.token).toBe(mockWalletToken.token);
      expect(walletsRepository.createToken).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'wallet.token.created',
        expect.any(Object),
      );
    });

    it('should reject 4th wallet token', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(mockWallet);
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      walletsRepository.countActiveTokensByWalletId.mockResolvedValue(3);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      await expect(service.createWalletToken(customerId)).rejects.toThrow(
        MaximumWalletTokensReachedException,
      );
    });

    it('should throw when wallet does not exist', async () => {
      walletsRepository.findByCustomerId.mockResolvedValue(null);

      await expect(service.createWalletToken(customerId)).rejects.toThrow(
        WalletNotFoundException,
      );
    });
  });

  describe('deposit', () => {
    it('should deposit money and return transaction', async () => {
      const mockTransaction = {
        id: '55555555-5555-5555-5555-555555555555',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        amount: '50.00',
        balanceBefore: '100.00',
        balanceAfter: '100.00',
        createdAt: new Date('2026-01-02'),
      };

      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      walletsRepository.updateBalance.mockResolvedValue(undefined);
      transactionsService.recordPending.mockResolvedValue(
        mockTransaction as never,
      );
      transactionsService.markSuccess.mockResolvedValue(undefined);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      const result = await service.deposit(
        customerId,
        mockWalletToken.token,
        50,
      );

      expect(result.type).toBe(TransactionType.DEPOSIT);
      expect(result.status).toBe(TransactionStatus.SUCCESS);
      expect(result.amount).toBe('50.00');
      expect(result.balanceAfter).toBe('150.00');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'wallet.deposited',
        expect.any(Object),
      );
      expect(transactionsService.recordPending).toHaveBeenCalled();
      expect(transactionsService.markSuccess).toHaveBeenCalledWith(
        mockTransaction.id,
        '150.00',
        expect.anything(),
      );
      expect(walletsRepository.updateBalance).toHaveBeenCalledWith(
        walletId,
        '150.00',
        expect.anything(),
      );
    });
  });

  describe('withdraw', () => {
    it('should withdraw money when balance is sufficient', async () => {
      const mockTransaction = {
        id: '66666666-6666-6666-6666-666666666666',
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        amount: '40.00',
        balanceBefore: '100.00',
        balanceAfter: '100.00',
        createdAt: new Date('2026-01-02'),
      };

      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      walletsRepository.updateBalance.mockResolvedValue(undefined);
      transactionsService.recordPending.mockResolvedValue(
        mockTransaction as never,
      );
      transactionsService.markSuccess.mockResolvedValue(undefined);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      const result = await service.withdraw(
        customerId,
        mockWalletToken.token,
        40,
      );

      expect(result.type).toBe(TransactionType.WITHDRAWAL);
      expect(result.status).toBe(TransactionStatus.SUCCESS);
      expect(result.balanceAfter).toBe('60.00');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'wallet.withdrawn',
        expect.any(Object),
      );
    });

    it('should reject withdrawal with insufficient balance and record failed attempt', async () => {
      const mockTransaction = {
        id: '77777777-7777-7777-7777-777777777777',
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        amount: '500.00',
        balanceBefore: '100.00',
        balanceAfter: '100.00',
        createdAt: new Date('2026-01-02'),
      };

      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      walletsRepository.findByIdWithLock.mockResolvedValue(mockWallet);
      transactionsService.recordPending.mockResolvedValue(
        mockTransaction as never,
      );
      transactionsService.markFailed.mockResolvedValue(undefined);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      await expect(
        service.withdraw(customerId, mockWalletToken.token, 500),
      ).rejects.toThrow(InsufficientBalanceException);

      expect(transactionsService.markFailed).toHaveBeenCalledWith(
        mockTransaction.id,
        '100.00',
        ErrorCode.INSUFFICIENT_BALANCE,
        expect.anything(),
      );
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('authorization', () => {
    it('should reject deposit when wallet token is missing', async () => {
      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        null,
      );

      await expect(
        service.deposit(customerId, 'missing-token', 10),
      ).rejects.toThrow(WalletTokenNotFoundException);
    });

    it('should reject deposit when wallet token is expired', async () => {
      const expiredToken = {
        ...mockWalletToken,
        expiresAt: new Date('2020-01-01'),
      } as WalletToken;
      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        expiredToken,
      );

      await expect(
        service.deposit(customerId, expiredToken.token, 10),
      ).rejects.toThrow(WalletTokenExpiredException);
    });

    it('should reject deposit when locked wallet disappears', async () => {
      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      walletsRepository.findByIdWithLock.mockResolvedValue(null);
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback({} as EntityManager),
      );

      await expect(
        service.deposit(customerId, mockWalletToken.token, 10),
      ).rejects.toThrow(WalletNotFoundException);
    });

    it('should reject deposit with unauthorized wallet access', async () => {
      const otherWallet = { ...mockWallet, customerId: otherCustomerId };
      const otherToken = {
        ...mockWalletToken,
        wallet: otherWallet,
      } as WalletToken;

      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        otherToken,
      );

      await expect(
        service.deposit(customerId, otherToken.token, 10),
      ).rejects.toThrow(UnauthorizedWalletAccessException);
    });

    it('should return paginated transaction history for authorized token', async () => {
      const tx = {
        id: 'tx-1',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
        failureReason: null,
        amount: '50.00',
        balanceBefore: '0.00',
        balanceAfter: '50.00',
        createdAt: new Date('2026-01-02'),
      };
      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      transactionsService.listByWallet.mockResolvedValue({
        items: [tx],
        total: 1,
      });

      const result = await service.getTransactions(
        customerId,
        mockWalletToken.token,
        1,
        10,
      );

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return zero total pages when there are no transactions', async () => {
      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        mockWalletToken,
      );
      transactionsService.listByWallet.mockResolvedValue({
        items: [],
        total: 0,
      });

      const result = await service.getTransactions(
        customerId,
        mockWalletToken.token,
        1,
        10,
      );

      expect(result.meta.totalPages).toBe(0);
    });

    it('should reject transaction history for another users token', async () => {
      const otherWallet = { ...mockWallet, customerId: otherCustomerId };
      const otherToken = {
        ...mockWalletToken,
        wallet: otherWallet,
      } as WalletToken;

      walletsRepository.findTokenByValueIncludingInactive.mockResolvedValue(
        otherToken,
      );

      await expect(
        service.getTransactions(customerId, otherToken.token, 1, 10),
      ).rejects.toThrow(UnauthorizedWalletAccessException);
    });
  });
});
