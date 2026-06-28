import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService
  ) {}

  async getLatestInsight(userId: string, month: string) {
    // Basic Rule-based Insight for MVP
    const walletOverview = await this.financeService.getWalletsOverview(userId, month);
    
    let mood = 'NEUTRAL';
    let title = 'Tình hình chi tiêu đang ở mức trung bình';
    let content = 'Hãy tiếp tục duy trì và theo dõi ngân sách nhé.';
    
    if (walletOverview.totalBudget > 0) {
      if (walletOverview.spentPercent < 60) {
        mood = 'GOOD';
        title = 'Bạn đang kiểm soát ngân sách rất tốt';
        content = 'Chi tiêu hiện tại dưới 60% ngân sách tháng này.';
      } else if (walletOverview.spentPercent < 80) {
        mood = 'ATTENTION';
        title = 'Cần chú ý chi tiêu';
        content = `Bạn đã dùng ${walletOverview.spentPercent}% ngân sách tháng này. Hãy chú ý các khoản chi nhỏ.`;
      } else if (walletOverview.spentPercent <= 100) {
        mood = 'WARNING';
        title = 'Cảnh báo ngân sách';
        content = 'Bạn đã dùng gần hết ngân sách tháng này!';
      } else {
        mood = 'DANGER';
        title = 'Vượt ngân sách!';
        content = 'Bạn đã vượt quá ngân sách tháng này. Nên xem lại các khoản chi lớn.';
      }
    }

    return {
      mood,
      title,
      content,
      sparkline: [20, 24, 30, 28, 35, 40, 43], // Mock sparkline
    };
  }
}
