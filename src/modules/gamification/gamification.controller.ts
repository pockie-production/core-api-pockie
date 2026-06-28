import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('gamification/streak')
  @ApiOperation({ summary: 'Get user streak for a specific month (YYYY-MM)' })
  async getStreak(@Req() req: any, @Query('month') month: string) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return this.gamificationService.getStreak(req.user.id, targetMonth);
  }

  @Get('missions/daily')
  @ApiOperation({ summary: 'Get daily missions' })
  async getDailyMissions(@Req() req: any, @Query('date') date: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.gamificationService.getDailyMissions(req.user.id, targetDate);
  }

  @Post('missions/:id/complete')
  @ApiOperation({ summary: 'Complete a mission' })
  async completeMission(@Req() req: any, @Param('id') missionId: string) {
    return this.gamificationService.completeMission(req.user.id, missionId);
  }
}
