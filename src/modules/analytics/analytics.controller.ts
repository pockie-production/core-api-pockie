import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalRoleGuard } from '../../common/guards/internal-role.guard';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Track end-user analytics event' })
  async trackUserEvent(@Req() req: any, @Body() dto: CreateAnalyticsEventDto) {
    return this.analyticsService.trackEvent(req.user.id, dto);
  }
}

@ApiTags('Internal Analytics')
@ApiBearerAuth()
@Controller('internal/analytics')
export class InternalAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @UseGuards(JwtAuthGuard, InternalRoleGuard)
  @ApiOperation({ summary: 'Track internal console analytics event' })
  async trackInternalEvent(@Req() req: any, @Body() dto: CreateAnalyticsEventDto) {
    return this.analyticsService.trackEvent(req.user.id, dto);
  }
}
