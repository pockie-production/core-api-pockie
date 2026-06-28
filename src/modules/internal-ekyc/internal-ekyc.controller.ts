import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InternalEkycService } from './internal-ekyc.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Internal eKYC')
@ApiBearerAuth()
@Controller('internal/ekyc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalEkycController {
  constructor(private readonly internalEkycService: InternalEkycService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get a list of eKYC sessions (with filters and pagination)' })
  @ApiResponse({ status: 200, description: 'Return paginated sessions.' })
  async getSessions(@Query() query: any) {
    return this.internalEkycService.getSessions(query);
  }

  @Get(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get detailed information about a specific eKYC session' })
  @ApiResponse({ status: 200, description: 'Return session details.' })
  async getSessionDetail(@Param('id') id: string, @Request() req: any) {
    const userRoles = req.user.roles || [];
    return this.internalEkycService.getSessionDetail(id, userRoles);
  }

  @Post(':id/approve')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Approve an eKYC session' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Session approved successfully.' })
  async approveSession(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.internalEkycService.approveSession(id, req.user.id, body.note);
  }

  @Post(':id/reject')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Reject an eKYC session' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' }, note: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Session rejected successfully.' })
  async rejectSession(@Param('id') id: string, @Body() body: { reason: string; note?: string }, @Request() req: any) {
    return this.internalEkycService.rejectSession(id, req.user.id, body.reason, body.note);
  }

  @Post(':id/retry')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Request the user to retry the eKYC process' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' }, note: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Retry requested successfully.' })
  async requestRetry(@Param('id') id: string, @Body() body: { reason: string; note?: string }, @Request() req: any) {
    return this.internalEkycService.requestRetry(id, req.user.id, body.reason, body.note);
  }

  @Post(':id/notes')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Add an internal note to the eKYC session' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Note added successfully.' })
  async addNote(@Param('id') id: string, @Body() body: { note: string }, @Request() req: any) {
    return this.internalEkycService.addNote(id, req.user.id, body.note);
  }

  @Get(':id/provider-logs')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN) // Note: No SUPPORT_STAFF here
  @ApiOperation({ summary: 'Get raw provider logs for the eKYC session (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return provider logs.' })
  async getProviderLogs(@Param('id') id: string, @Request() req: any) {
    const userRoles = req.user.roles || [];
    return this.internalEkycService.getProviderLogs(id, userRoles);
  }
}
