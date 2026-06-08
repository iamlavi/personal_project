/** DTOs for deposit/withdraw body and transaction list query params. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class WalletOperationDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' })
  @IsString()
  @IsNotEmpty()
  walletToken: string;

  @ApiProperty({ example: 100.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class TransactionQueryDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' })
  @IsString()
  @IsNotEmpty()
  walletToken: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    default: 1,
    example: 1,
    description: 'Page number (1-based)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
    description: 'Items per page (max 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
