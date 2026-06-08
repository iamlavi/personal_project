/**
 * Propagates or generates x-correlation-id on requests and responses.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      correlationId?: string;
    }>();

    const correlationId =
      request.headers[CORRELATION_ID_HEADER] ?? randomUUID();

    request.correlationId = correlationId;
    request.headers[CORRELATION_ID_HEADER] = correlationId;

    const response = context.switchToHttp().getResponse<{
      setHeader: (name: string, value: string) => void;
    }>();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    return next.handle();
  }
}
