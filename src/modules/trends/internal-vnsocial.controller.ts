import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TrendsService } from './trends.service';

@ApiTags('Internal VnSocial')
@ApiBearerAuth()
@Controller('internal/vnsocial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalVnsocialController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get('projects')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get cached VnSocial projects and stats' })
  async getProjects() {
    return this.trendsService.listProjects();
  }

  @Get('sync-jobs')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get recent VnSocial sync jobs' })
  async getSyncJobs() {
    return this.trendsService.listSyncJobs();
  }

  @Post('sync-projects')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiOperation({ summary: 'Sync VnSocial projects into local cache' })
  @ApiResponse({ status: 201, description: 'Projects synced successfully.' })
  async syncProjects(@Request() req: any) {
    return this.trendsService.syncProjects(req.user.id);
  }

  @Post('projects/:id/sync-posts')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiOperation({ summary: 'Sync VnSocial posts for a project' })
  async syncPosts(@Param('id') id: string, @Request() req: any) {
    return this.trendsService.syncProjectPosts(id, req.user.id);
  }

  @Post('projects/:id/sync-hot-keywords')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiOperation({ summary: 'Sync VnSocial hot keywords for a project' })
  async syncHotKeywords(@Param('id') id: string, @Request() req: any) {
    return this.trendsService.syncProjectHotKeywords(id, req.user.id);
  }

  @Post('projects/:id/sync-hot-posts')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN)
  @ApiOperation({ summary: 'Sync VnSocial hot posts for a project' })
  async syncHotPosts(@Param('id') id: string, @Request() req: any) {
    return this.trendsService.syncProjectHotPosts(id, req.user.id);
  }
}
