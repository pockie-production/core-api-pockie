import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        gamificationProfile: true,
        authIdentities: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let nextLevelXp = 0;
    if (user.gamificationProfile) {
      const currentLevel = user.gamificationProfile.level;
      const nextLevelRule = await this.prisma.levelRule.findUnique({
        where: { level: currentLevel + 1 },
      });
      nextLevelXp = nextLevelRule ? nextLevelRule.requiredTotalXp : user.gamificationProfile.totalXp;
    }

    let xpProgressPercent = 0;
    if (user.gamificationProfile && nextLevelXp > 0) {
      // Calculate progress between current level required xp and next level required xp
      const currentLevelRule = await this.prisma.levelRule.findUnique({
        where: { level: user.gamificationProfile.level },
      });
      const baseLevelXp = currentLevelRule ? currentLevelRule.requiredTotalXp : 0;
      
      const xpIntoCurrentLevel = Math.max(0, user.gamificationProfile.totalXp - baseLevelXp);
      const xpNeededForNextLevel = Math.max(1, nextLevelXp - baseLevelXp);
      
      xpProgressPercent = Math.min(100, Math.round((xpIntoCurrentLevel / xpNeededForNextLevel) * 100));
    } else if (user.gamificationProfile && nextLevelXp === user.gamificationProfile.totalXp) {
      xpProgressPercent = 100;
    }

    const hasOAuthIdentity = user.authIdentities.length > 0;
    const authProvider = hasOAuthIdentity
      ? user.authIdentities[0].provider.toUpperCase()
      : user.passwordHash
        ? 'PASSWORD'
        : 'GOOGLE';
    const featureAccess = this.getFeatureAccess(user.kycStatus);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.profile?.fullName || null,
      displayName: user.profile?.displayName || user.profile?.fullName || 'Chưa cập nhật tên',
      avatarUrl: user.profile?.avatarFileId || null,
      kycStatus: user.kycStatus,
      level: user.gamificationProfile?.level || 1,
      currentXp: user.gamificationProfile?.currentXp || 0,
      nextLevelXp,
      xpProgressPercent,
      authProvider,
      featureAccess,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        gamificationProfile: true,
        authIdentities: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedPhone = this.normalizeOptional(dto.phone);
    if (normalizedPhone && normalizedPhone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingPhone && existingPhone.id !== userId) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { phone: normalizedPhone },
        });
      }

      const displayName = this.normalizeOptional(dto.displayName);
      const fullName = this.normalizeOptional(dto.fullName);
      if (dto.displayName !== undefined || dto.fullName !== undefined) {
        await tx.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            displayName,
            fullName,
          },
          update: {
            ...(dto.displayName !== undefined ? { displayName } : {}),
            ...(dto.fullName !== undefined ? { fullName } : {}),
          },
        });
      }
    });

    return {
      message: 'Cập nhật hồ sơ thành công.',
      user: await this.getMe(userId),
    };
  }

  private normalizeOptional(value?: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private getFeatureAccess(kycStatus: string) {
    const verified = kycStatus === 'VERIFIED';
    return {
      canUseAI: verified,
      canUseOCR: verified,
      canClaimPersonalizedVoucher: verified,
      reason: verified ? 'VERIFIED' : 'EKYC_REQUIRED',
    };
  }
}
