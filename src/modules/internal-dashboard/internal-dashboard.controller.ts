import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InternalDashboardService } from './internal-dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalRoleGuard } from '../../common/guards/internal-role.guard';

@ApiTags('Internal Dashboard')
@ApiBearerAuth()
@Controller('internal/dashboard')
@UseGuards(JwtAuthGuard, InternalRoleGuard)
export class InternalDashboardController {
  constructor(private readonly internalDashboardService: InternalDashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get internal dashboard overview statistics' })
  @ApiResponse({ status: 200, description: 'Return overview stats.' })
  async getOverview() {
    return this.internalDashboardService.getOverview();
  }

  @Get('ekyc-funnel')
  @ApiOperation({ summary: 'Get eKYC conversion funnel analytics' })
  @ApiResponse({ status: 200, description: 'Return eKYC funnel analytics.' })
  async getEkycFunnel() {
    return this.internalDashboardService.getEkycFunnel();
  }

  @Get('feature-usage')
  @ApiOperation({ summary: 'Get feature usage analytics' })
  @ApiResponse({ status: 200, description: 'Return feature usage analytics.' })
  async getFeatureUsage() {
    return this.internalDashboardService.getFeatureUsage();
  }

  @Get('system-health')
  @ApiOperation({ summary: 'Get real-time system health and telemetry' })
  @ApiResponse({ status: 200, description: 'Return system health data.' })
  async getSystemHealth() {
    return this.internalDashboardService.getSystemHealth();
  }
}
