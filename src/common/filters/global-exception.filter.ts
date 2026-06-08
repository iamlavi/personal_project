/**
 * Catches all thrown errors and normalizes them into a single JSON shape.
 * Logs stack traces server-side; clients never see raw 500 details.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { BaseApplicationException } from '../exceptions/exceptions';
import { ErrorCode } from '../constants/error-codes';

interface ErrorResponse {
  success: false;
  message: string;
  errorCode?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errorCode } = this.resolveException(exception);
    const correlationId =
      (request.headers['x-correlation-id'] as string) ?? 'no-correlation-id';

    const logMeta = {
      correlationId,
      method: request.method,
      url: request.url,
      status,
      errorCode,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logMeta),
      );
    } else {
      this.logger.warn(JSON.stringify({ message, ...logMeta }));
    }

    const body: ErrorResponse = {
      success: false,
      message,
      ...(errorCode && { errorCode }),
    };

    response.status(status).json(body);
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string;
    errorCode?: string;
  } {
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests',
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      };
    }

    if (exception instanceof BaseApplicationException) {
      const response = exception.getResponse() as {
        message: string;
        errorCode: ErrorCode;
      };
      return {
        status: exception.getStatus(),
        message: response.message,
        errorCode: response.errorCode,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { status, message: response };
      }

      const responseObj = response as Record<string, unknown>;
      const message = Array.isArray(responseObj.message)
        ? (responseObj.message as string[]).join(', ')
        : ((responseObj.message as string) ?? exception.message);

      return {
        status,
        message,
        errorCode:
          status === HttpStatus.BAD_REQUEST
            ? ErrorCode.VALIDATION_ERROR
            : undefined,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errorCode: ErrorCode.INTERNAL_ERROR,
    };
  }
}
