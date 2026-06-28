import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Google OAuth Endpoints
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req) {
    // req.user will contain the user object returned from validateOAuthLogin
    return {
      message: 'Google login successful',
      data: req.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req) {
    return req.user;
  }
}
