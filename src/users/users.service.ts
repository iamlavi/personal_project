/**
 * UsersService — customer registration and lookup.
 *
 * Password hashing happens in the Customer entity (@BeforeInsert/@BeforeUpdate),
 * so this service passes plain text and lets TypeORM lifecycle hooks handle it.
 */
import { Injectable } from '@nestjs/common';
import { Customer } from '../database/entities/customer.entity';
import {
  CustomerNotFoundException,
  EmailAlreadyExistsException,
} from '../common/exceptions/exceptions';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createCustomer(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<Customer> {
    const existing = await this.usersRepository.findByEmail(data.email);
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    return this.usersRepository.create(data);
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByIdOrFail(id: string): Promise<Customer> {
    const customer = await this.usersRepository.findById(id);
    if (!customer) {
      throw new CustomerNotFoundException();
    }
    return customer;
  }
}
