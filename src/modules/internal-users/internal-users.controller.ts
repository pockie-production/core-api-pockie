import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InternalUsersService } from './internal-users.service';
import { InternalUsersQueryDto, UpdateInternalUserStatusDto } from './dto/internal-users.dto';

@ApiTags('Internal Users')
@ApiBearerAuth()
@Controller('internal/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalUsersController {
  constructor(private readonly internalUsersService: InternalUsersService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get paginated internal users list with filters' })
  @ApiResponse({ status: 200, description: 'Return paginated users list.' })
  async getUsers(@Query() query: InternalUsersQueryDto) {
    return this.internalUsersService.getUsers(query);
  }

  @Get(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Get internal user detail' })
  @ApiResponse({ status: 200, description: 'Return user detail.' })
  async getUserDetail(@Param('id') id: string) {
    return this.internalUsersService.getUserDetail(id);
  }

  @Patch(':id/status')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.SUPPORT_STAFF)
  @ApiOperation({ summary: 'Update internal user account status' })
  @ApiBody({ type: UpdateInternalUserStatusDto })
  @ApiResponse({ status: 200, description: 'User status updated successfully.' })
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateInternalUserStatusDto, @Request() req: any) {
    return this.internalUsersService.updateUserStatus(id, req.user.id, dto);
  }
}
