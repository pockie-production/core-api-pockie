import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions for current user' })
  async getSessions(@Req() req: any) {
    return this.aiService.getSessions(req.user.id);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session for current user' })
  async createSession(@Req() req: any) {
    return this.aiService.createSession(req.user.id);
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get chat messages in a session' })
  async getSessionMessages(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.aiService.getSessionMessages(req.user.id, sessionId);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message in a specific chat session' })
  async sendSessionMessage(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body('message') message: string,
  ) {
    return this.aiService.chatInSession(req.user.id, sessionId, message || '');
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI finance assistant using live user data' })
  async chat(@Req() req: any, @Body('message') message: string, @Body('sessionId') sessionId?: string) {
    return this.aiService.chat(req.user.id, message || '', sessionId);
  }
}
