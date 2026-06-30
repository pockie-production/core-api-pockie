import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreak(userId: string, month: string) {
    // Extract year and month, e.g., '2026-06'
    const [year, monthStr] = month.split('-');
    
    // Naive implementation for MVP
    const profile = await this.prisma.userGamificationProfile.findUnique({
      where: { userId },
    });

    const days = await this.prisma.userStreakDay.findMany({
      where: {
        userId,
        date: {
          gte: new Date(`${year}-${monthStr}-01`),
          lt: new Date(Number(year), Number(monthStr), 1),
        },
      },
      orderBy: { date: 'asc' },
    });

    return {
      currentDays: profile?.currentStreakDays || 0,
      longestDays: profile?.longestStreakDays || 0,
      week: days.slice(-7).map(d => ({
        date: d.date.toISOString().split('T')[0],
        completed: d.isCompleted,
      })),
    };
  }

  async getDailyMissions(userId: string, date: string) {
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const activeMissions = await this.prisma.mission.findMany({
      where: { status: 'ACTIVE' },
    });

    // Create mission logs if they don't exist for today
    const items = await Promise.all(activeMissions.map(async (mission) => {
      let log = await this.prisma.userMissionLog.findUnique({
        where: {
          userId_missionId_date: {
            userId,
            missionId: mission.id,
            date: targetDate,
          }
        }
      });

      if (!log) {
        log = await this.prisma.userMissionLog.create({
          data: {
            userId,
            missionId: mission.id,
            date: targetDate,
            status: 'IN_PROGRESS',
            progress: 0,
          }
        });
      }

      return {
        id: mission.id, // using mission id as the key for completion
        title: mission.title,
        description: mission.description,
        status: log.status,
        progress: log.progress,
        targetValue: mission.targetValue,
        xpReward: mission.xpReward,
        requiresConfirm: mission.metadata ? (mission.metadata as any).requiresConfirm || false : false,
      };
    }));

    return {
      date,
      items,
    };
  }

  async completeMission(userId: string, missionId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findUnique({ where: { id: missionId } });
      if (!mission) throw new NotFoundException('Mission not found');

      const log = await tx.userMissionLog.findUnique({
        where: {
          userId_missionId_date: {
            userId,
            missionId,
            date: today,
          }
        }
      });

      if (!log) throw new BadRequestException('Mission log not found for today');
      if (log.status === 'COMPLETED') throw new BadRequestException('Mission already completed');

      // 1. Update UserMissionLog
      const updatedLog = await tx.userMissionLog.update({
        where: { id: log.id },
        data: {
          status: 'COMPLETED',
          progress: mission.targetValue,
          completedAt: new Date(),
          xpAwarded: mission.xpReward,
        }
      });

      // 2. Create XpEvent
      await tx.xpEvent.create({
        data: {
          userId,
          sourceType: 'MISSION_COMPLETE',
          sourceId: log.id,
          xpAmount: mission.xpReward,
          reason: `Completed mission: ${mission.title}`,
        }
      });

      // 3. Update UserGamificationProfile
      const profile = await tx.userGamificationProfile.upsert({
        where: { userId },
        create: {
          userId,
          totalXp: mission.xpReward,
          currentXp: mission.xpReward,
        },
        update: {
          totalXp: { increment: mission.xpReward },
          currentXp: { increment: mission.xpReward },
        }
      });

      // Check level up (naive implementation)
      let leveledUp = false;
      const nextLevelRule = await tx.levelRule.findUnique({
        where: { level: profile.level + 1 }
      });
      
      if (nextLevelRule && profile.totalXp >= nextLevelRule.requiredTotalXp) {
        await tx.userGamificationProfile.update({
          where: { userId },
          data: { level: { increment: 1 } }
        });
        leveledUp = true;
      }

      // 4. Update streak (if this was the first completed mission today, we could increment)
      const streakDay = await tx.userStreakDay.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          }
        },
        create: {
          userId,
          date: today,
          isCompleted: true,
          completedMissionCount: 1,
        },
        update: {
          isCompleted: true,
          completedMissionCount: { increment: 1 }
        }
      });
      
      // 5. Create Notification
      await tx.notification.create({
        data: {
          userId,
          type: 'MISSION_COMPLETED',
          title: 'Bạn đã hoàn thành nhiệm vụ!',
          body: `+${mission.xpReward} XP đã được cộng vào tài khoản.`,
          dataJson: { missionId: mission.id, xpAwarded: mission.xpReward }
        }
      });

      return {
        mission: {
          id: mission.id,
          status: 'COMPLETED',
          xpAwarded: mission.xpReward,
        },
        gamification: {
          level: profile.level + (leveledUp ? 1 : 0),
          currentXp: profile.currentXp,
          totalXp: profile.totalXp,
          leveledUp,
        },
        streak: {
          currentDays: profile.currentStreakDays,
        }
      };
    });
  }

  // --- Admin Methods ---

  async getAdminMissions() {
    return this.prisma.mission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdminMission(data: any) {
    return this.prisma.mission.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        missionType: data.missionType || 'DAILY',
        targetValue: data.targetValue || 1,
        xpReward: data.xpReward || 0,
        status: data.status || 'ACTIVE',
        metadata: data.metadata || {},
      },
    });
  }

  async updateAdminMission(id: string, data: any) {
    return this.prisma.mission.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        missionType: data.missionType,
        targetValue: data.targetValue,
        xpReward: data.xpReward,
        status: data.status,
        metadata: data.metadata,
      },
    });
  }

  async getAdminProfiles() {
    return this.prisma.userGamificationProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          }
        }
      },
      orderBy: { totalXp: 'desc' },
    });
  }
}
