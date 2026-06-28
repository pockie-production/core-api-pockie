import { Module } from '@nestjs/common';
import { InternalDashboardController } from './internal-dashboard.controller';
import { InternalDashboardService } from './internal-dashboard.service';

@Module({
  controllers: [InternalDashboardController],
  providers: [InternalDashboardService]
})
export class InternalDashboardModule {}
