import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode } from '../constants/error-codes';
import { WalletNotFoundException } from '../exceptions/exceptions';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({
          method: 'POST',
          url: '/wallets/deposit',
          headers: { 'x-correlation-id': 'corr-123' },
        }),
      }),
    } as ArgumentsHost;
  });

  it('should map domain exceptions to JSON error responses', () => {
    filter.catch(new WalletNotFoundException(), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Wallet not found',
      errorCode: ErrorCode.WALLET_NOT_FOUND,
    });
  });

  it('should map throttler exceptions to 429', () => {
    filter.catch(new ThrottlerException(), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Too many requests',
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  });

  it('should map HttpException string responses', () => {
    filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Forbidden',
    });
  });

  it('should map validation errors to VALIDATION_ERROR', () => {
    filter.catch(
      new BadRequestException({ message: ['email must be an email'] }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'email must be an email',
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('should map HttpException object responses without validation code', () => {
    filter.catch(new HttpException('Conflict', HttpStatus.CONFLICT), host);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Conflict',
    });
  });

  it('should fall back to exception message when response message is missing', () => {
    filter.catch(
      new HttpException({ foo: 'bar' }, HttpStatus.BAD_REQUEST),
      host,
    );

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: ErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it('should handle unknown errors with 500 response body', () => {
    filter.catch(new Error('boom'), host);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('should handle non-Error internal failures', () => {
    filter.catch('unexpected', host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
