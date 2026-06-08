/**
 * End-to-end tests — full HTTP flow against a real PostgreSQL database.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { configureHttpApp } from '../src/bootstrap-app';
import { Customer } from '../src/database/entities/customer.entity';
import { Wallet } from '../src/database/entities/wallet.entity';
import { WalletToken } from '../src/database/entities/wallet-token.entity';
import {
  Transaction,
  TransactionStatus,
} from '../src/database/entities/transaction.entity';
import { WalletsService } from '../src/wallets/wallets.service';

describe('Wallet API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  /** New supertest call per request; Connection: close avoids response mix-ups. */
  let client: () => {
    get: (path: string) => request.Test;
    post: (path: string) => request.Test;
  };
  let authService: AuthService;
  let walletsService: WalletsService;
  let customerRepository: Repository<Customer>;
  let walletRepository: Repository<Wallet>;
  let walletTokenRepository: Repository<WalletToken>;
  let transactionRepository: Repository<Transaction>;
  let accessToken: string;
  let walletToken: string;

  const testCustomer = {
    email: `e2e-${Date.now()}@example.com`,
    password: 'SecurePass123!',
    name: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);

    await app.init();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    server.keepAliveTimeout = 0;

    const req = (method: 'get' | 'post', path: string) =>
      request(server)[method](path).set('Connection', 'close');

    client = () => ({
      get: (path: string) => req('get', path),
      post: (path: string) => req('post', path),
    });
    authService = moduleFixture.get(AuthService);
    walletsService = moduleFixture.get(WalletsService);
    customerRepository = moduleFixture.get(getRepositoryToken(Customer));
    walletRepository = moduleFixture.get(getRepositoryToken(Wallet));
    walletTokenRepository = moduleFixture.get(getRepositoryToken(WalletToken));
    transactionRepository = moduleFixture.get(getRepositoryToken(Transaction));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Auth', () => {
    it('should register and login a customer', async () => {
      const registerResponse = await client()
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send(testCustomer)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.accessToken).toBeDefined();

      const loginResponse = await client()
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
        })
        .expect(200);

      accessToken = loginResponse.body.data.accessToken;
      expect(accessToken).toBeDefined();
    });

    it('should return 404 when register is called with GET (wrong method)', async () => {
      await client().get('/auth/register').expect(404);
    });
  });

  describe('Wallet', () => {
    it('should create a wallet with zero balance', async () => {
      const response = await client()
        .post('/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe('0.00');
    });

    it('should reject duplicate wallet creation', async () => {
      const response = await client()
        .post('/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('WALLET_ALREADY_EXISTS');
    });

    it('should create wallet tokens up to the limit', async () => {
      for (let i = 0; i < 3; i++) {
        const response = await client()
          .post('/wallets/tokens')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(201);

        expect(response.body.data.token).toBeDefined();
        if (i === 0) {
          walletToken = response.body.data.token;
        }
      }
    });

    it('should reject 4th wallet token', async () => {
      const response = await client()
        .post('/wallets/tokens')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('MAXIMUM_WALLET_TOKENS_REACHED');
    });
  });

  describe('Deposit', () => {
    it('should deposit money and update balance', async () => {
      expect(walletToken).toBeDefined();

      const response = await client()
        .post('/wallets/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ walletToken, amount: 500 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('DEPOSIT');
      expect(response.body.data.status).toBe('SUCCESS');
      expect(response.body.data.amount).toBe('500.00');
      expect(response.body.data.balanceAfter).toBe('500.00');

      const walletResponse = await client()
        .get('/wallets/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(walletResponse.body.data.balance).toBe('500.00');
    });

    it('should reject deposit with another users wallet token', async () => {
      const otherCustomer = await customerRepository.save(
        customerRepository.create({
          email: `other-deposit-${Date.now()}@example.com`,
          password: 'hashed',
          name: 'Other User',
        }),
      );
      const otherWallet = await walletRepository.save(
        walletRepository.create({
          customerId: otherCustomer.id,
          balance: '100.00',
        }),
      );
      const otherToken = await walletTokenRepository.save(
        walletTokenRepository.create({
          walletId: otherWallet.id,
          token: `other-deposit-token-${Date.now()}`,
        }),
      );

      const response = await client()
        .post('/wallets/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ walletToken: otherToken.token, amount: 50 })
        .expect(403);

      expect(response.body.errorCode).toBe('UNAUTHORIZED_WALLET_ACCESS');

      await walletTokenRepository.delete({ id: otherToken.id });
      await walletRepository.delete({ id: otherWallet.id });
      await customerRepository.delete({ id: otherCustomer.id });
    });
  });

  describe('Withdrawal', () => {
    it('should withdraw money when balance is sufficient', async () => {
      const response = await client()
        .post('/wallets/withdraw')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ walletToken, amount: 200 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('WITHDRAWAL');
      expect(response.body.data.balanceAfter).toBe('300.00');
    });

    it('should reject withdrawal with insufficient balance', async () => {
      const response = await client()
        .post('/wallets/withdraw')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ walletToken, amount: 10000 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INSUFFICIENT_BALANCE');

      const failedTx = await transactionRepository.findOne({
        where: {
          amount: '10000.00',
          status: TransactionStatus.FAILED,
        },
        order: { createdAt: 'DESC' },
      });
      expect(failedTx).toBeDefined();
      expect(failedTx?.failureReason).toBe('INSUFFICIENT_BALANCE');
      expect(failedTx?.balanceBefore).toBe(failedTx?.balanceAfter);
    });
  });

  describe('Transaction history', () => {
    it('should return paginated transaction history', async () => {
      const response = await client()
        .get('/wallets/transactions')
        .query({ walletToken, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.meta.total).toBeGreaterThanOrEqual(2);
      expect(response.body.data.meta.page).toBe(1);
    });

    it('should reject unauthorized wallet access', async () => {
      const otherCustomer = await customerRepository.save(
        customerRepository.create({
          email: `other-${Date.now()}@example.com`,
          password: 'hashed',
          name: 'Other User',
        }),
      );
      const otherWallet = await walletRepository.save(
        walletRepository.create({
          customerId: otherCustomer.id,
          balance: '100.00',
        }),
      );
      const otherToken = await walletTokenRepository.save(
        walletTokenRepository.create({
          walletId: otherWallet.id,
          token: `other-token-${Date.now()}`,
        }),
      );

      const response = await client()
        .get('/wallets/transactions')
        .query({ walletToken: otherToken.token, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('UNAUTHORIZED_WALLET_ACCESS');

      await transactionRepository.delete({ walletId: otherWallet.id });
      await walletTokenRepository.delete({ walletId: otherWallet.id });
      await walletRepository.delete({ id: otherWallet.id });
      await customerRepository.delete({ id: otherCustomer.id });
    });
  });

  describe('Concurrency', () => {
    /** fetch() per parallel call — supertest can mix responses under Promise.all. */
    const postAuth = async (
      path: string,
      token: string,
      body?: Record<string, unknown>,
    ) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
      };
    };

    /** Service setup — concurrency tests only exercise parallel HTTP on wallet ops. */
    const setupCustomer = async (label: string, withWalletToken = false) => {
      const auth = await authService.register({
        email: `e2e-concurrent-${label}-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        name: `Concurrent ${label}`,
      });
      await walletsService.createWallet(auth.customer.id);

      let walletTokenValue: string | undefined;
      if (withWalletToken) {
        const walletToken = await walletsService.createWalletToken(
          auth.customer.id,
        );
        walletTokenValue = walletToken.token;
      }

      return {
        accessToken: auth.accessToken,
        walletToken: walletTokenValue,
        customerId: auth.customer.id,
      };
    };

    it('should allow exactly 3 of 4 parallel token creations', async () => {
      const { accessToken: concurrentToken, customerId } =
        await setupCustomer('tokens');

      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          postAuth('/wallets/tokens', concurrentToken),
        ),
      );

      const successCount = responses.filter((r) => r.status === 201).length;
      const failureCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(3);
      expect(failureCount).toBe(1);
      expect(responses.find((r) => r.status === 400)?.body.errorCode).toBe(
        'MAXIMUM_WALLET_TOKENS_REACHED',
      );

      const wallet = await walletRepository.findOne({
        where: { customerId },
      });
      const activeTokens = await walletTokenRepository.count({
        where: { walletId: wallet!.id },
      });
      expect(activeTokens).toBe(3);
    });

    it('should apply both parallel deposits without lost updates', async () => {
      const {
        accessToken: concurrentToken,
        walletToken: concurrentWalletToken,
        customerId,
      } = await setupCustomer('deposits', true);

      const responses = await Promise.all([
        postAuth('/wallets/deposit', concurrentToken, {
          walletToken: concurrentWalletToken,
          amount: 100,
        }),
        postAuth('/wallets/deposit', concurrentToken, {
          walletToken: concurrentWalletToken,
          amount: 100,
        }),
      ]);

      expect(responses.map((r) => r.status).sort()).toEqual([201, 201]);
      expect(responses.every((r) => r.body.success === true)).toBe(true);

      const wallet = await walletRepository.findOne({
        where: { customerId },
      });
      expect(wallet?.balance).toBe('200.00');
    });

    it('should allow only one of two parallel over-limit withdrawals', async () => {
      const {
        accessToken: concurrentToken,
        walletToken: concurrentWalletToken,
        customerId,
      } = await setupCustomer('withdrawals', true);

      await walletsService.deposit(customerId, concurrentWalletToken!, 800);

      const responses = await Promise.all([
        postAuth('/wallets/withdraw', concurrentToken, {
          walletToken: concurrentWalletToken,
          amount: 600,
        }),
        postAuth('/wallets/withdraw', concurrentToken, {
          walletToken: concurrentWalletToken,
          amount: 600,
        }),
      ]);

      const successCount = responses.filter((r) => r.status === 201).length;
      const failureCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
      expect(responses.find((r) => r.status === 400)?.body.errorCode).toBe(
        'INSUFFICIENT_BALANCE',
      );

      const wallet = await walletRepository.findOne({
        where: { customerId },
      });
      expect(wallet?.balance).toBe('200.00');

      const successWithdrawals = await transactionRepository.count({
        where: {
          walletId: wallet!.id,
          status: TransactionStatus.SUCCESS,
          amount: '600.00',
        },
      });
      const failedWithdrawals = await transactionRepository.count({
        where: {
          walletId: wallet!.id,
          status: TransactionStatus.FAILED,
          amount: '600.00',
        },
      });

      expect(successWithdrawals).toBe(1);
      expect(failedWithdrawals).toBe(1);
    });
  });
});
