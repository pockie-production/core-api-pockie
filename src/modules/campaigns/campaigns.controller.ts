import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { CampaignsService } from './campaigns.service';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: List campaigns' })
  async listCampaigns(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.campaignsService.listCampaigns({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      search,
      status,
      organizationId,
    });
  }

  @Post()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: Create a new campaign' })
  async createCampaign(@Req() req: any, @Body() body: any) {
    // Default organization for now
    const data = {
      ...body,
      organizationId: body.organizationId || 'org-1',
    };
    return this.campaignsService.createCampaign(data, req.user.id);
  }

  @Get(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: Get campaign details' })
  async getCampaign(@Param('id') id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @Put(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin: Update a campaign' })
  async updateCampaign(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.campaignsService.updateCampaign(id, body, req.user.id);
  }

  @Post(':id/approve')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin/Checker: Approve a campaign' })
  async approveCampaign(@Req() req: any, @Param('id') id: string) {
    return this.campaignsService.approveCampaign(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN)
  @ApiOperation({ summary: 'Admin/Checker: Reject a campaign' })
  async rejectCampaign(@Req() req: any, @Param('id') id: string) {
    return this.campaignsService.rejectCampaign(id, req.user.id);
  }
}
