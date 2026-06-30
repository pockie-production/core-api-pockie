import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('report-view')
  @ApiOperation({ summary: 'Get AI-backed report view data for end-user chat workspace' })
  async getReportView(@Req() req: any) {
    return this.aiService.getReportView(req.user.id);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI finance assistant using live user data' })
  async chat(@Req() req: any, @Body('message') message: string) {
    return this.aiService.chat(req.user.id, message || '');
  }
}
