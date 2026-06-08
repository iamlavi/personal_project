/**
 * UsersRepository — data access for Customer records.
 *
 * Keeps TypeORM queries out of UsersService so the service layer
 * can focus on validation and business rules.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../database/entities/customer.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  /** Lookup by email. Password is included because the column uses `select: false`. */
  async findByEmail(email: string): Promise<Customer | null> {
    return this.customerRepository
      .createQueryBuilder('customer')
      .addSelect('customer.password')
      .where('customer.email = :email', { email: email.toLowerCase().trim() })
      .getOne();
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { id } });
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<Customer> {
    const customer = this.customerRepository.create(data);
    return this.customerRepository.save(customer);
  }
}
