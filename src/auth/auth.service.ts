import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SignupDto, LoginDto } from './dto/auth.dto';
import { RoleCode, KycStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        kycStatus: KycStatus.NOT_STARTED,
        roles: {
          create: {
            role: RoleCode.END_USER,
          },
        },
      },
      include: {
        roles: true,
      },
    });

    return this.generateTokens(user.id, user.roles.map((r) => r.role));
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.roles.map((r) => r.role));
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { roles: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // In a real app, verify if the refresh token is in the database and not revoked
      return this.generateTokens(user.id, user.roles.map((r) => r.role));
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateOAuthLogin(profile: any): Promise<any> {
    const email = profile.emails[0].value;

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      // Create user if they don't exist
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: '', // OAuth users don't have a password
          kycStatus: KycStatus.NOT_STARTED,
          roles: {
            create: {
              role: RoleCode.END_USER,
            },
          },
        },
        include: {
          roles: true,
        },
      });
    }

    return this.generateTokens(user.id, user.roles.map((r) => r.role));
  }

  private async generateTokens(userId: string, roles: RoleCode[]) {
    const payload = { sub: userId, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any,
      }),
    ]);

    // In a real app, save the refreshToken to the DB
    return {
      accessToken,
      refreshToken,
    };
  }
}
