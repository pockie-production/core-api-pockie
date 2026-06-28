import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InternalEkycService } from './internal-ekyc.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';

@Controller('api/v1/internal/ekyc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalEkycController {
  constructor(private readonly internalEkycService: InternalEkycService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  async getSessions(@Query() query: any) {
    return this.internalEkycService.getSessions(query);
  }

  @Get(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  async getSessionDetail(@Param('id') id: string, @Request() req: any) {
    const userRoles = req.user.roles || [];
    return this.internalEkycService.getSessionDetail(id, userRoles);
  }

  @Post(':id/approve')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  async approveSession(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.internalEkycService.approveSession(id, req.user.id, body.note);
  }

  @Post(':id/reject')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  async rejectSession(@Param('id') id: string, @Body() body: { reason: string; note?: string }, @Request() req: any) {
    return this.internalEkycService.rejectSession(id, req.user.id, body.reason, body.note);
  }

  @Post(':id/retry')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  async requestRetry(@Param('id') id: string, @Body() body: { reason: string; note?: string }, @Request() req: any) {
    return this.internalEkycService.requestRetry(id, req.user.id, body.reason, body.note);
  }

  @Post(':id/notes')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  async addNote(@Param('id') id: string, @Body() body: { note: string }, @Request() req: any) {
    return this.internalEkycService.addNote(id, req.user.id, body.note);
  }

  @Get(':id/provider-logs')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN) // Note: No SUPPORT_STAFF here
  async getProviderLogs(@Param('id') id: string, @Request() req: any) {
    const userRoles = req.user.roles || [];
    return this.internalEkycService.getProviderLogs(id, userRoles);
  }
}
