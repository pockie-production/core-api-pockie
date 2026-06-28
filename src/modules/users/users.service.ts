import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        gamificationProfile: true,
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

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.profile?.displayName || user.profile?.fullName || 'User',
      avatarUrl: user.profile?.avatarFileId || null,
      kycStatus: user.kycStatus,
      level: user.gamificationProfile?.level || 1,
      currentXp: user.gamificationProfile?.currentXp || 0,
      nextLevelXp,
      xpProgressPercent,
    };
  }
}
