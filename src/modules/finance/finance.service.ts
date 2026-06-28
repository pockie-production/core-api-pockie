import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletsOverview(userId: string, month: string) {
    const budget = await this.prisma.monthlyBudget.findUnique({
      where: {
        userId_month: {
          userId,
          month,
        }
      }
    });

    const [year, monthStr] = month.split('-');
    const startDate = new Date(`${year}-${monthStr}-01T00:00:00.000Z`);
    const endDate = new Date(Number(year), Number(monthStr), 1); // 1st of next month

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        transactionDate: {
          gte: startDate,
          lt: endDate,
        },
        transactionType: 'EXPENSE',
      }
    });

    const spent = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalBudget = budget ? Number(budget.totalBudget) : 0;
    const remaining = totalBudget - spent;
    const spentPercent = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;

    return {
      month,
      totalBudget,
      spent,
      remaining,
      spentPercent,
      currency: budget?.currency || 'VND',
    };
  }

  async getRecentTransactions(userId: string, limit: number) {
    const transactions = await this.prisma.financialTransaction.findMany({
      where: { userId },
      orderBy: { transactionDate: 'desc' },
      take: limit,
      include: {
        category: true,
      }
    });

    return transactions.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category.name,
      icon: t.category.icon,
      amount: Number(t.amount),
      currency: t.currency,
      transactionDate: t.transactionDate,
    }));
  }

  async getCategoryStats(userId: string, month: string) {
    const [year, monthStr] = month.split('-');
    const startDate = new Date(`${year}-${monthStr}-01T00:00:00.000Z`);
    const endDate = new Date(Number(year), Number(monthStr), 1);

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        transactionDate: {
          gte: startDate,
          lt: endDate,
        },
        transactionType: 'EXPENSE',
      },
      include: {
        category: true,
      }
    });

    const totalExpense = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const statsMap = new Map<string, any>();

    for (const t of transactions) {
      if (!statsMap.has(t.categoryId)) {
        statsMap.set(t.categoryId, {
          categoryId: t.categoryId,
          categoryName: t.category.name,
          icon: t.category.icon,
          amount: 0,
        });
      }
      const stat = statsMap.get(t.categoryId);
      stat.amount += Number(t.amount);
    }

    const items = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      percent: totalExpense > 0 ? Math.round((stat.amount / totalExpense) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return { items };
  }
}
