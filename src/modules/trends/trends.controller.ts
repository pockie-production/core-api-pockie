import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TrendDecisionDto, TrendsQueryDto } from './dto/trends.dto';
import { TrendsService } from './trends.service';

@ApiTags('Internal Trends')
@ApiBearerAuth()
@Controller('internal/trends')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get cached trends list for internal review' })
  async getTrends(@Query() query: TrendsQueryDto) {
    return this.trendsService.listTrends(query);
  }

  @Get(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get trend detail' })
  async getTrendDetail(@Param('id') id: string) {
    return this.trendsService.getTrendDetail(id);
  }

  @Post(':id/approve')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiBody({ type: TrendDecisionDto })
  @ApiResponse({ status: 201, description: 'Trend approved successfully.' })
  async approveTrend(@Param('id') id: string, @Body() dto: TrendDecisionDto, @Request() req: any) {
    return this.trendsService.approveTrend(id, req.user.id, dto);
  }

  @Post(':id/reject')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiBody({ type: TrendDecisionDto })
  @ApiResponse({ status: 201, description: 'Trend rejected successfully.' })
  async rejectTrend(@Param('id') id: string, @Body() dto: TrendDecisionDto, @Request() req: any) {
    return this.trendsService.rejectTrend(id, req.user.id, dto);
  }

  @Post(':id/deploy')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiBody({ type: TrendDecisionDto })
  @ApiResponse({ status: 201, description: 'Trend deployed successfully.' })
  async deployTrend(@Param('id') id: string, @Body() dto: TrendDecisionDto, @Request() req: any) {
    return this.trendsService.deployTrend(id, req.user.id, dto);
  }

  @Post(':id/archive')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiBody({ type: TrendDecisionDto })
  @ApiResponse({ status: 201, description: 'Trend archived successfully.' })
  async archiveTrend(@Param('id') id: string, @Body() dto: TrendDecisionDto, @Request() req: any) {
    return this.trendsService.archiveTrend(id, req.user.id, dto);
  }
}
