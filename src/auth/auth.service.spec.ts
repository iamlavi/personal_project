import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InvalidCredentialsException } from '../common/exceptions/exceptions';
import { Customer } from '../database/entities/customer.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'createCustomer'>
  >;

  const loginDto = {
    email: 'user@example.com',
    password: 'SecurePass123!',
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      createCustomer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('1h'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should register a customer and return auth response', async () => {
      const customer = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'user@example.com',
        name: 'Test User',
      } as Customer;
      usersService.createCustomer.mockResolvedValue(customer);

      const result = await service.register({
        email: customer.email,
        password: 'SecurePass123!',
        name: customer.name,
      });

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.customer).toEqual({
        id: customer.id,
        email: customer.email,
        name: customer.name,
      });
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const customer = {
        id: '11111111-1111-1111-1111-111111111111',
        email: loginDto.email,
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(true),
      } as unknown as Customer;

      usersService.findByEmail.mockResolvedValue(customer);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.expiresIn).toBe('1h');
    });

    it('should reject login when email is not registered', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
    });

    it('should reject login when password is wrong', async () => {
      const customer = {
        id: '11111111-1111-1111-1111-111111111111',
        email: loginDto.email,
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(false),
      } as unknown as Customer;

      usersService.findByEmail.mockResolvedValue(customer);

      await expect(service.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
      expect(customer.comparePassword).toHaveBeenCalledWith(loginDto.password);
    });
  });
});
