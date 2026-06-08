import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WalletToken } from '../database/entities/wallet-token.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { WalletsRepository } from './wallets.repository';

describe('WalletsRepository', () => {
  let repository: WalletsRepository;
  let walletRepository: jest.Mocked<Repository<Wallet>>;
  let walletTokenRepository: jest.Mocked<Repository<WalletToken>>;

  const mockQueryBuilder = () => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(2),
    getMany: jest.fn().mockResolvedValue([]),
  });

  beforeEach(async () => {
    walletRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Wallet>>;

    walletTokenRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<WalletToken>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsRepository,
        { provide: getRepositoryToken(Wallet), useValue: walletRepository },
        {
          provide: getRepositoryToken(WalletToken),
          useValue: walletTokenRepository,
        },
      ],
    }).compile();

    repository = module.get(WalletsRepository);
  });

  it('should create wallets and look them up by customer', async () => {
    const wallet = { id: 'wallet-1', customerId: 'customer-1' } as Wallet;
    walletRepository.findOne.mockResolvedValue(wallet);
    walletRepository.create.mockReturnValue(wallet);
    walletRepository.save.mockResolvedValue(wallet);

    await expect(repository.findByCustomerId('customer-1')).resolves.toBe(
      wallet,
    );
    await expect(repository.createWallet('customer-1')).resolves.toBe(wallet);
  });

  it('should update balances through the entity manager', async () => {
    const manager = { update: jest.fn().mockResolvedValue(undefined) };
    await repository.updateBalance('wallet-1', '50.00', manager as never);

    expect(manager.update).toHaveBeenCalledWith(
      Wallet,
      { id: 'wallet-1' },
      { balance: '50.00' },
    );
  });

  it('should find tokens including inactive ones', async () => {
    const token = { id: 'token-1' } as WalletToken;
    walletTokenRepository.findOne.mockResolvedValue(token);

    await expect(
      repository.findTokenByValueIncludingInactive('token-value'),
    ).resolves.toBe(token);
  });

  it('should create tokens on the default repository', async () => {
    const token = { id: 'token-1' } as WalletToken;
    walletTokenRepository.create.mockReturnValue(token);
    walletTokenRepository.save.mockResolvedValue(token);

    const result = await repository.createToken(
      'wallet-1',
      'token-value',
      null,
    );

    expect(result).toBe(token);
  });

  it('should return only active tokens from findActiveTokenByValue', async () => {
    const activeToken = Object.assign(new WalletToken(), {
      token: 'active',
      expiresAt: null,
      isActive: () => true,
    });
    walletTokenRepository.findOne.mockResolvedValue(activeToken);

    await expect(repository.findActiveTokenByValue('active')).resolves.toBe(
      activeToken,
    );
  });

  it('should return null for inactive tokens from findActiveTokenByValue', async () => {
    const inactiveToken = Object.assign(new WalletToken(), {
      token: 'inactive',
      expiresAt: new Date('2020-01-01'),
      isActive: () => false,
    });
    walletTokenRepository.findOne.mockResolvedValue(inactiveToken);

    await expect(
      repository.findActiveTokenByValue('inactive'),
    ).resolves.toBeNull();
  });

  it('should count active tokens with query builder', async () => {
    const builder = mockQueryBuilder();
    walletTokenRepository.createQueryBuilder.mockReturnValue(builder as never);

    await expect(
      repository.countActiveTokensByWalletId('wallet-1'),
    ).resolves.toBe(2);
    expect(builder.getCount).toHaveBeenCalled();
  });

  it('should count active tokens using a transaction manager', async () => {
    const builder = mockQueryBuilder();
    const managerRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    } as unknown as EntityManager;

    await repository.countActiveTokensByWalletId('wallet-1', manager);

    expect(manager.getRepository).toHaveBeenCalledWith(WalletToken);
  });

  it('should create tokens through a transaction manager', async () => {
    const token = { id: 'token-1' } as WalletToken;
    const managerRepo = {
      create: jest.fn().mockReturnValue(token),
      save: jest.fn().mockResolvedValue(token),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    } as unknown as EntityManager;

    const result = await repository.createToken(
      'wallet-1',
      'token-value',
      null,
      manager,
    );

    expect(result).toBe(token);
    expect(managerRepo.save).toHaveBeenCalled();
  });
});
