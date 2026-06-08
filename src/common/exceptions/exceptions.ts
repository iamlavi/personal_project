// istanbul ignore file
/**
 * Domain exceptions mapped to HTTP status + stable errorCode strings.
 *
 * GlobalExceptionFilter reads BaseApplicationException to produce consistent
 * `{ success: false, message, errorCode }` responses.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export class BaseApplicationException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode: ErrorCode,
    status: HttpStatus,
  ) {
    super({ message, errorCode }, status);
  }
}

export class CustomerNotFoundException extends BaseApplicationException {
  constructor() {
    super(
      'Customer not found',
      ErrorCode.CUSTOMER_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidCredentialsException extends BaseApplicationException {
  constructor() {
    super(
      'Invalid credentials',
      ErrorCode.INVALID_CREDENTIALS,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class EmailAlreadyExistsException extends BaseApplicationException {
  constructor() {
    super(
      'Email already exists',
      ErrorCode.EMAIL_ALREADY_EXISTS,
      HttpStatus.CONFLICT,
    );
  }
}

export class WalletNotFoundException extends BaseApplicationException {
  constructor() {
    super('Wallet not found', ErrorCode.WALLET_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

export class WalletAlreadyExistsException extends BaseApplicationException {
  constructor() {
    super(
      'Customer already has a wallet',
      ErrorCode.WALLET_ALREADY_EXISTS,
      HttpStatus.CONFLICT,
    );
  }
}

export class WalletTokenNotFoundException extends BaseApplicationException {
  constructor() {
    super(
      'Wallet token not found',
      ErrorCode.WALLET_TOKEN_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MaximumWalletTokensReachedException extends BaseApplicationException {
  constructor() {
    super(
      'Maximum wallet tokens reached',
      ErrorCode.MAXIMUM_WALLET_TOKENS_REACHED,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InsufficientBalanceException extends BaseApplicationException {
  constructor() {
    super(
      'Insufficient balance',
      ErrorCode.INSUFFICIENT_BALANCE,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class UnauthorizedWalletAccessException extends BaseApplicationException {
  constructor() {
    super(
      'Unauthorized wallet access',
      ErrorCode.UNAUTHORIZED_WALLET_ACCESS,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class WalletTokenExpiredException extends BaseApplicationException {
  constructor() {
    super(
      'Wallet token has expired',
      ErrorCode.WALLET_TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
    );
  }
}
