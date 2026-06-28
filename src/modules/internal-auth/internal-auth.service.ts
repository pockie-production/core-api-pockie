import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { InternalLoginDto, InternalRefreshDto } from './dto/internal-auth.dto';
import { RoleCode, UserStatus, LoginAttemptResult } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InternalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private throwError(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST): never {
    throw new HttpException(
      {
        error: {
          code,
          message,
          details: null,
        },
      },
      status,
    );
  }

  async login(dto: InternalLoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: true, profile: true },
    });

    if (!user) {
      await this.logAttempt(dto.email, LoginAttemptResult.USER_NOT_FOUND);
      this.throwError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.', HttpStatus.UNAUTHORIZED);
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.logAttempt(dto.email, LoginAttemptResult.USER_SUSPENDED);
      this.throwError('USER_SUSPENDED', 'Tài khoản đã bị khóa.', HttpStatus.FORBIDDEN);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.logAttempt(dto.email, LoginAttemptResult.FAILED_PASSWORD);
      this.throwError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.', HttpStatus.UNAUTHORIZED);
    }

    const roles = user.roles.map((r) => r.role);
    const hasInternalRole = roles.some((r) =>
      ([RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF] as RoleCode[]).includes(r),
    );

    if (!hasInternalRole) {
      await this.logAttempt(dto.email, LoginAttemptResult.INTERNAL_ACCESS_DENIED);
      this.throwError('INTERNAL_ACCESS_DENIED', 'Tài khoản này không có quyền truy cập Internal Console.', HttpStatus.FORBIDDEN);
    }

    await this.logAttempt(dto.email, LoginAttemptResult.SUCCESS);
    return this.generateAuthResponse(user.id, user.email || '', user.status, roles, user.profile);
  }

  async refresh(dto: InternalRefreshDto) {
    try {
      const decoded = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Verify the token exists and is not revoked in DB
      const jti = decoded.jti;
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { id: jti },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new Error('Token revoked');
      }

      // Check hash (in this case, token string itself if we store hash)
      const isMatch = await bcrypt.compare(dto.refreshToken, storedToken.tokenHash);
      if (!isMatch) {
        throw new Error('Hash mismatch');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { roles: true, profile: true },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        this.throwError('USER_SUSPENDED', 'Tài khoản bị khóa', HttpStatus.FORBIDDEN);
      }

      const roles = user.roles.map((r) => r.role);
      const hasInternalRole = roles.some((r) =>
        ([RoleCode.SUPER_ADMIN, RoleCode.INTERNAL_ADMIN, RoleCode.CONTENT_ADMIN, RoleCode.SUPPORT_STAFF] as RoleCode[]).includes(r),
      );

      if (!hasInternalRole) {
        this.throwError('INTERNAL_ACCESS_DENIED', 'Không có quyền truy cập', HttpStatus.FORBIDDEN);
      }

      // Revoke old token
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return this.generateAuthResponse(user.id, user.email || '', user.status, roles, user.profile);
    } catch (e) {
      this.throwError('REFRESH_TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', HttpStatus.UNAUTHORIZED);
    }
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });

      if (decoded.sub !== userId) {
        this.throwError('UNAUTHORIZED', 'Invalid user', HttpStatus.UNAUTHORIZED);
      }

      await this.prisma.refreshToken.update({
        where: { id: decoded.jti },
        data: { revokedAt: new Date() },
      });
      return { success: true };
    } catch (e) {
      return { success: true };
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        profile: true,
      },
    });

    if (!user) {
      this.throwError('UNAUTHORIZED', 'Không tìm thấy user', HttpStatus.UNAUTHORIZED);
    }

    const roles = user.roles.map(r => r.role);
    
    // Get permissions
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { in: roles } },
      include: { permission: true }
    });

    const permissions = Array.from(new Set(rolePermissions.map(rp => rp.permission.code)));

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      profile: user.profile ? {
        fullName: user.profile.fullName,
        displayName: user.profile.displayName
      } : null
    };
  }

  private async generateAuthResponse(userId: string, email: string, status: string, roles: RoleCode[], profile: any) {
    const jti = uuidv4();
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
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      user: {
        id: userId,
        email,
        status,
        roles,
        profile: profile ? {
          fullName: profile.fullName,
          displayName: profile.displayName
        } : null
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900 // 15 mins
      }
    };
  }

  private async logAttempt(email: string, result: LoginAttemptResult) {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          email,
          result,
        }
      });
    } catch (e) {
      console.error('Failed to log login attempt', e);
    }
  }
}
