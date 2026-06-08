/**
 * Wallet HTTP API — thin controller; all rules live in WalletsService.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { TransactionQueryDto, WalletOperationDto } from './wallets.dto';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a wallet for the authenticated customer' })
  createWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.createWallet(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated customer wallet' })
  getMyWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.getWalletByCustomerId(user.id);
  }

  @Post('tokens')
  @ApiOperation({
    summary: 'Create a new wallet token (max 3 active per wallet)',
  })
  createWalletToken(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.createWalletToken(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Deposit money into wallet' })
  deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletOperationDto,
  ) {
    return this.walletsService.deposit(user.id, dto.walletToken, dto.amount);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Withdraw money from wallet' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletOperationDto,
  ) {
    return this.walletsService.withdraw(user.id, dto.walletToken, dto.amount);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated transaction history' })
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletsService.getTransactions(
      user.id,
      query.walletToken,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }
}
