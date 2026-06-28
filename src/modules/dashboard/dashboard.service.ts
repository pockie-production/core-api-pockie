import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly financeService: FinanceService,
    private readonly notificationsService: NotificationsService,
    private readonly insightsService: InsightsService
  ) {}

  async getHome(userId: string, month: string) {
    const today = new Date().toISOString().split('T')[0];
    const targetMonth = month || today.slice(0, 7);

    // Run all independent queries in parallel
    const [
      profile,
      notifications,
      missions,
      streak,
      wallet,
      insight,
      recentTransactions,
      categoryStats
    ] = await Promise.all([
      this.usersService.getMe(userId),
      this.notificationsService.getNotifications(userId, 5),
      this.gamificationService.getDailyMissions(userId, today),
      this.gamificationService.getStreak(userId, targetMonth),
      this.financeService.getWalletsOverview(userId, targetMonth),
      this.insightsService.getLatestInsight(userId, targetMonth),
      this.financeService.getRecentTransactions(userId, 5),
      this.financeService.getCategoryStats(userId, targetMonth)
    ]);

    const featureAccess = {
      canUseAI: profile.kycStatus === 'VERIFIED',
      canUseOCR: profile.kycStatus === 'VERIFIED',
      canClaimPersonalizedVoucher: profile.kycStatus === 'VERIFIED',
      reason: profile.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'EKYC_REQUIRED',
    };

    return {
      profile,
      featureAccess,
      notifications,
      missions,
      streak,
      wallet,
      insight,
      recentTransactions,
      categoryStats
    };
  }
}
