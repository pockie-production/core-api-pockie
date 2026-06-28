import { Controller, Post, Get, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EnduserEkycService } from './enduser-ekyc.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleCode } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('End-user eKYC')
@ApiBearerAuth()
@Controller('ekyc/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnduserEkycController {
  constructor(private readonly enduserEkycService: EnduserEkycService) {}

  @Post()
  @Roles(RoleCode.END_USER)
  @ApiOperation({ summary: 'Create a new eKYC session' })
  @ApiResponse({ status: 201, description: 'Session created successfully.' })
  async createSession(@Request() req: any) {
    return this.enduserEkycService.createSession(req.user.id);
  }

  @Post(':id/documents')
  @Roles(RoleCode.END_USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document (front/back ID or selfie) for an eKYC session' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string' },
        side: { type: 'string' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully.' })
  async uploadDocument(
    @Param('id') id: string,
    @Body() body: { documentType: string, side: string },
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.enduserEkycService.uploadDocument(id, req.user.id, body, file);
  }

  @Post(':id/submit')
  @Roles(RoleCode.END_USER)
  @ApiOperation({ summary: 'Submit an eKYC session for processing/review' })
  @ApiResponse({ status: 201, description: 'Session submitted successfully.' })
  async submitSession(@Param('id') id: string, @Request() req: any) {
    return this.enduserEkycService.submitSession(id, req.user.id);
  }

  @Get(':id/status')
  @Roles(RoleCode.END_USER)
  @ApiOperation({ summary: 'Get the status of an eKYC session' })
  @ApiResponse({ status: 200, description: 'Return session status.' })
  async getStatus(@Param('id') id: string, @Request() req: any) {
    return this.enduserEkycService.getStatus(id, req.user.id);
  }
}
