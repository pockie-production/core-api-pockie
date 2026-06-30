import { Injectable } from '@nestjs/common';
import { FinanceService } from '../finance/finance.service';
import { GamificationService } from '../gamification/gamification.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AiService {
  constructor(
    private readonly financeService: FinanceService,
    private readonly gamificationService: GamificationService,
    private readonly usersService: UsersService,
  ) {}

  async getReportView(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const [overview, categoryStats] = await Promise.all([
      this.financeService.getWalletsOverview(userId, month),
      this.financeService.getCategoryStats(userId, month),
    ]);

    const categories = categoryStats.items.slice(0, 4).map((item, index) => ({
      name: item.categoryName,
      percent: item.percent,
      icon: item.icon || ['🍔', '🛍️', '🚌', '🎮'][index % 4],
      color: ['var(--color-danger)', 'var(--color-primary)', 'var(--color-mint)', 'var(--color-yellow)'][index % 4],
      bgIconColor: ['#FFE8D6', '#E0F4FF', '#DCFCE7', '#FEF3C7'][index % 4],
    }));

    return {
      title: `Phan tich chi tieu thang ${month.slice(5)}`,
      subtitle: 'Duoc tong hop tu du lieu giao dich hien tai cua ban',
      mood: overview.spentPercent > 80 ? 'WARNING' : overview.spentPercent > 60 ? 'ATTENTION' : 'GOOD',
      insightTitle:
        overview.spentPercent > 80
          ? 'Ban dang su dung gan het ngan sach thang nay'
          : overview.spentPercent > 60
            ? 'Chi tieu dang o muc can theo doi'
            : 'Tinh hinh chi tieu dang duoc kiem soat tot',
      totalExpense: overview.expense,
      budget: this.formatCurrency(overview.totalBudget, overview.currency),
      categories,
    };
  }

  async chat(userId: string, message: string) {
    const lowerInput = message.trim().toLowerCase();
    const month = new Date().toISOString().slice(0, 7);

    if (
      lowerInput.includes('bao cao') ||
      lowerInput.includes('phan tich') ||
      lowerInput.includes('chi tieu')
    ) {
      const [overview, categoryStats] = await Promise.all([
        this.financeService.getWalletsOverview(userId, month),
        this.financeService.getCategoryStats(userId, month),
      ]);
      const topCategory = categoryStats.items[0];

      return {
        workspace: 'reports',
        reply: topCategory
          ? `Thang nay ban da chi **${overview.expense}** tren tong ngan sach **${this.formatCurrency(overview.totalBudget, overview.currency)}**. Danh muc chi lon nhat hien tai la **${topCategory.categoryName} (${topCategory.percent}%)**.`
          : `Thang nay ban da chi **${overview.expense}** tren tong ngan sach **${this.formatCurrency(overview.totalBudget, overview.currency)}**. Hien chua co du lieu danh muc chi tieu noi bat.`,
      };
    }

    if (
      lowerInput.includes('vi') ||
      lowerInput.includes('tai san') ||
      lowerInput.includes('so du')
    ) {
      const overview = await this.financeService.getWalletsOverview(userId, month);
      return {
        workspace: 'wallet',
        reply: `Tong tai san hien tai cua ban la **${overview.summary.balance}**. Thang nay ban da chi **${overview.summary.expense}** va con lai **${this.formatCurrency(overview.remaining, overview.currency)}** de su dung.`,
      };
    }

    if (
      lowerInput.includes('muc tieu') ||
      lowerInput.includes('tiet kiem') ||
      lowerInput.includes('ke hoach')
    ) {
      const [profile, overview, missions] = await Promise.all([
        this.gamificationService.getUserProfile(userId),
        this.financeService.getWalletsOverview(userId, month),
        this.gamificationService.getDailyMissions(userId, new Date().toISOString().split('T')[0]),
      ]);
      const remainingXp = Math.max((profile.nextLevelXpRequired || profile.totalXp) - profile.totalXp, 0);
      return {
        workspace: 'goals',
        reply: `Ban dang o **Level ${profile.level}** voi **${profile.totalXp} XP**. Can them **${remainingXp} XP** de len level tiep theo. Hom nay ban co **${missions.items.length}** mission, va voi ngan sach con lai **${this.formatCurrency(overview.remaining, overview.currency)}**, day la thoi diem tot de dat muc tieu tiet kiem nho.`,
      };
    }

    if (
      lowerInput.includes('cai dat') ||
      lowerInput.includes('tai khoan') ||
      lowerInput.includes('mat khau')
    ) {
      const profile = await this.usersService.getMe(userId);
      return {
        workspace: 'settings',
        reply: `Tai khoan cua ban dang o trang thai eKYC **${profile.kycStatus}**. Ban co the cap nhat thong tin ca nhan, doi mat khau, hoac kiem tra cac tinh nang duoc mo khoa trong muc Cai dat.`,
      };
    }

    return {
      workspace: 'none',
      reply: 'Toi co the giup ban phan tich chi tieu, xem vi, muc tieu tai chinh, bao cao, hoac cai dat tai khoan. Thu hoi toi mot cau cu the hon nhe.',
    };
  }

  private formatCurrency(value: number, currency = 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
