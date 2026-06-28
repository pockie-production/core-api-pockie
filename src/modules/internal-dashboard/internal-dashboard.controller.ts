import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalDashboardService } from './internal-dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalRoleGuard } from '../../common/guards/internal-role.guard';

@ApiTags('Internal Dashboard')
@Controller('internal/dashboard')
@UseGuards(JwtAuthGuard, InternalRoleGuard)
export class InternalDashboardController {
  constructor(private readonly internalDashboardService: InternalDashboardService) {}

  @Get('overview')
  async getOverview() {
    return this.internalDashboardService.getOverview();
  }

  @Get('ekyc-funnel')
  async getEkycFunnel() {
    return this.internalDashboardService.getEkycFunnel();
  }

  @Get('feature-usage')
  async getFeatureUsage() {
    return this.internalDashboardService.getFeatureUsage();
  }

  @Get('system-health')
  async getSystemHealth() {
    return this.internalDashboardService.getSystemHealth();
  }
}
