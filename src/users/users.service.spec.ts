import { Test, TestingModule } from '@nestjs/testing';
import {
  CustomerNotFoundException,
  EmailAlreadyExistsException,
} from '../common/exceptions/exceptions';
import { Customer } from '../database/entities/customer.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;

  const customer = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    name: 'Test User',
  } as Customer;

  beforeEach(async () => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('createCustomer', () => {
    it('should create a customer when email is available', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.create.mockResolvedValue(customer);

      const result = await service.createCustomer({
        email: customer.email,
        password: 'SecurePass123!',
        name: customer.name,
      });

      expect(result).toBe(customer);
      expect(usersRepository.create).toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      usersRepository.findByEmail.mockResolvedValue(customer);

      await expect(
        service.createCustomer({
          email: customer.email,
          password: 'SecurePass123!',
          name: customer.name,
        }),
      ).rejects.toThrow(EmailAlreadyExistsException);
    });
  });

  describe('findByEmail', () => {
    it('should delegate to repository', async () => {
      usersRepository.findByEmail.mockResolvedValue(customer);

      await expect(service.findByEmail(customer.email)).resolves.toBe(customer);
    });
  });

  describe('findByIdOrFail', () => {
    it('should return customer when found', async () => {
      usersRepository.findById.mockResolvedValue(customer);

      await expect(service.findByIdOrFail(customer.id)).resolves.toBe(customer);
    });

    it('should throw when customer is missing', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.findByIdOrFail(customer.id)).rejects.toThrow(
        CustomerNotFoundException,
      );
    });
  });
});
