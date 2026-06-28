import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { InternalAuthService } from './internal-auth.service';
import { InternalLoginDto, InternalRefreshDto, InternalLogoutDto } from './dto/internal-auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalRoleGuard } from '../../common/guards/internal-role.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Internal Auth')
@Controller('internal/auth')
export class InternalAuthController {
  constructor(private readonly internalAuthService: InternalAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login to Internal Console' })
  @ApiBody({ type: InternalLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Access denied or User suspended' })
  async login(@Body() dto: InternalLoginDto) {
    return this.internalAuthService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh Internal access token' })
  @ApiBody({ type: InternalRefreshDto })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(@Body() dto: InternalRefreshDto) {
    return this.internalAuthService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout Internal user' })
  @ApiBody({ type: InternalLogoutDto })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req, @Body() dto: InternalLogoutDto) {
    return this.internalAuthService.logout(req.user.id, dto.refreshToken);
  }
}

@ApiTags('Internal Auth')
@Controller('internal')
export class InternalMeController {
  constructor(private readonly internalAuthService: InternalAuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, InternalRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current Internal user profile and permissions' })
  @ApiResponse({ status: 200, description: 'Profile retrieved' })
  async getMe(@Req() req) {
    return this.internalAuthService.getMe(req.user.id);
  }
}
