import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { GamificationService } from './gamification.service';

@ApiTags('Internal Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
@Controller('internal/gamification')
export class InternalGamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('missions')
  @ApiOperation({ summary: 'Admin: Get all missions' })
  async getMissions() {
    return this.gamificationService.getAdminMissions();
  }

  @Post('missions')
  @ApiOperation({ summary: 'Admin: Create a new mission' })
  async createMission(@Body() data: any) {
    return this.gamificationService.createAdminMission(data);
  }

  @Put('missions/:id')
  @ApiOperation({ summary: 'Admin: Update a mission' })
  async updateMission(@Param('id') id: string, @Body() data: any) {
    return this.gamificationService.updateAdminMission(id, data);
  }

  @Get('profiles')
  @ApiOperation({ summary: 'Admin: Get user gamification profiles (Leaderboard)' })
  async getProfiles() {
    return this.gamificationService.getAdminProfiles();
  }
}
