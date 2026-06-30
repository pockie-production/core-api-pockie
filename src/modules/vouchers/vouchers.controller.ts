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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { VouchersService } from './vouchers.service';
import { Body, Query } from '@nestjs/common';

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

  // --- ADMIN API ---
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: List all vouchers' })
  async listForAdmin(@Query('skip') skip?: string, @Query('take') take?: string, @Query('search') search?: string, @Query('status') status?: string) {
    return this.vouchersService.listVouchersForAdmin({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      search,
      status,
    });
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: Create a new voucher' })
  async createVoucher(@Req() req: any, @Body() body: any) {
    return this.vouchersService.createVoucher(body, req.user.id);
  }

  @Post('admin/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin/Checker: Approve a voucher' })
  async approveVoucher(@Req() req: any, @Param('id') id: string) {
    return this.vouchersService.approveVoucher(id, req.user.id);
  }

  @Post('admin/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin/Checker: Reject a voucher' })
  async rejectVoucher(@Req() req: any, @Param('id') id: string) {
    return this.vouchersService.rejectVoucher(id, req.user.id);
  }
}
