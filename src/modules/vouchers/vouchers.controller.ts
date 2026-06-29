import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VouchersService } from './vouchers.service';

@ApiTags('Vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get('available')
  @ApiOperation({ summary: 'List active vouchers and claim eligibility for current user' })
  @ApiResponse({ status: 200, description: 'Available vouchers returned' })
  async listAvailable(@Req() req: any) {
    return this.vouchersService.listAvailableVouchers(req.user.id);
  }

  @Get('my-claims')
  @ApiOperation({ summary: 'List voucher claims of current user' })
  @ApiResponse({ status: 200, description: 'Voucher claims returned' })
  async listMyClaims(@Req() req: any) {
    return this.vouchersService.listMyClaims(req.user.id);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim a voucher with verified-identity anti-spam rules' })
  @ApiResponse({ status: 201, description: 'Voucher claimed successfully' })
  async claimVoucher(@Req() req: any, @Param('id') id: string) {
    return this.vouchersService.claimVoucher(req.user.id, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
