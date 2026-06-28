import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto, FirebaseLoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new end user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('firebase/login')
  @ApiOperation({ summary: 'Login using Firebase ID Token from client Google Sign-in' })
  @ApiBody({ type: FirebaseLoginDto })
  @ApiResponse({ status: 200, description: 'Firebase login successful' })
  async firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.authService.verifyFirebaseToken(dto.idToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  getProfile(@Req() req) {
    return req.user;
  }
}
