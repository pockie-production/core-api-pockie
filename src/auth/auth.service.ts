import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SignupDto, LoginDto } from './dto/auth.dto';
import { RoleCode, KycStatus } from '@prisma/client';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    if (!getApps().length) {
      initializeApp({
        credential: cert(path.resolve(process.cwd(), 'service.json')),
      });
    }
  }

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

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { id: decoded.jti },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const isMatch = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (!isMatch) {
        throw new UnauthorizedException('Refresh token mismatch');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { roles: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return this.generateTokens(user.id, user.roles.map((r) => r.role));
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyFirebaseToken(idToken: string) {
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const email = decodedToken.email;

      if (!email) {
        throw new UnauthorizedException('Firebase token does not contain an email');
      }

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
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: true,
        message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được tạo.',
      };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      success: true,
      message: 'Mock reset token đã được tạo.',
      resetToken: rawToken,
      expiresAt,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashResetToken(token);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Reset token không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công.',
    };
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });

      if (decoded.sub !== userId) {
        throw new UnauthorizedException('Invalid user');
      }

      await this.prisma.refreshToken.update({
        where: { id: decoded.jti },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      return { success: true };
    }

    return { success: true };
  }

  private async generateTokens(userId: string, roles: RoleCode[]) {
    const jti = randomUUID();
    const payload = { sub: userId, roles, jti };

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

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
