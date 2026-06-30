import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('wallets/overview')
  @ApiOperation({ summary: 'Get wallet overview for a specific month' })
  async getWalletsOverview(@Req() req: any, @Query('month') month: string) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return this.financeService.getWalletsOverview(req.user.id, targetMonth);
  }

  @Get('transactions/recent')
  @ApiOperation({ summary: 'Get recent transactions' })
  async getRecentTransactions(@Req() req: any, @Query('limit') limit?: number) {
    const take = limit ? Number(limit) : 5;
    return this.financeService.getRecentTransactions(req.user.id, take);
  }

  @Get('transactions/categories')
  @ApiOperation({ summary: 'Get transaction stats by categories' })
  async getCategoryStats(@Req() req: any, @Query('month') month: string) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return this.financeService.getCategoryStats(req.user.id, targetMonth);
  }

  @Get('wallets/accounts')
  @ApiOperation({ summary: 'Get list of wallet accounts' })
  async getAccounts(@Req() req: any) {
    return this.financeService.getAccounts(req.user.id);
  }
}
