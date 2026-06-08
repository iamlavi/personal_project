/**
 * AuthService — register/login and JWT access tokens.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InvalidCredentialsException } from '../common/exceptions/exceptions';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResponse {
  accessToken: string;
  expiresIn: string;
  customer: {
    id: string;
    email: string;
    name: string;
  };
}

interface AccessTokenPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const customer = await this.usersService.createCustomer(dto);
    return this.buildAuthResponse(customer.id, customer.email, customer.name);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const customer = await this.usersService.findByEmail(dto.email);
    if (!customer) {
      throw new InvalidCredentialsException();
    }

    const isValid = await customer.comparePassword(dto.password);
    if (!isValid) {
      throw new InvalidCredentialsException();
    }

    return this.buildAuthResponse(customer.id, customer.email, customer.name);
  }

  private buildAuthResponse(
    id: string,
    email: string,
    name: string,
  ): AuthResponse {
    const expiresIn = this.configService.getOrThrow<string>(
      'jwt.accessExpiresIn',
    );

    const accessToken = this.jwtService.sign(
      { sub: id, email } satisfies AccessTokenPayload,
      { expiresIn: expiresIn as `${number}m` },
    );

    return {
      accessToken,
      expiresIn,
      customer: { id, email, name },
    };
  }
}
