import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type DateRange = {
  start: Date;
  end: Date;
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletsOverview(userId: string, month: string) {
    const currentRange = this.getMonthRange(month);
    const previousRange = this.getPreviousMonthRange(month);

    const [wallets, currentTransactions, previousTransactions, monthlyBudget, monthlySummary] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.financialTransaction.findMany({
        where: {
          userId,
          deletedAt: null,
          transactionDate: {
            gte: currentRange.start,
            lt: currentRange.end,
          },
        },
      }),
      this.prisma.financialTransaction.findMany({
        where: {
          userId,
          deletedAt: null,
          transactionDate: {
            gte: previousRange.start,
            lt: previousRange.end,
          },
        },
      }),
      this.prisma.monthlyBudget.findUnique({
        where: {
          userId_month: {
            userId,
            month,
          },
        },
      }),
      this.prisma.monthlyFinancialSummary.findUnique({
        where: {
          userId_month: {
            userId,
            month,
          },
        },
      }),
    ]);

    const totalBalance = wallets.reduce((sum, wallet) => sum + this.toNumber(wallet.balance), 0);
    const currentIncome = this.sumTransactionsByType(currentTransactions, 'INCOME');
    const currentExpense = this.sumTransactionsByType(currentTransactions, 'EXPENSE');
    const previousIncome = this.sumTransactionsByType(previousTransactions, 'INCOME');
    const previousExpense = this.sumTransactionsByType(previousTransactions, 'EXPENSE');

    const totalBudget = monthlyBudget
      ? this.toNumber(monthlyBudget.totalBudget)
      : monthlySummary
        ? this.toNumber(monthlySummary.totalBudget)
        : Math.max(currentIncome, currentExpense, totalBalance, 0);
    const remaining = Math.max(totalBudget - currentExpense, 0);
    const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((currentExpense / totalBudget) * 100)) : 0;
    const previousNet = previousIncome - previousExpense;
    const currentNet = currentIncome - currentExpense;

    const allocations = this.buildAllocations(wallets, totalBalance);

    return {
      month,
      allocations,
      summary: {
        balance: this.formatCurrency(totalBalance),
        diffAmount: this.formatSignedCurrency(currentNet - previousNet),
        diffType: currentNet - previousNet >= 0 ? 'up' : 'down',
        income: this.formatCurrency(currentIncome),
        expense: this.formatCurrency(currentExpense),
        savingsPercent: currentIncome > 0 ? Math.max(0, Math.round(((currentIncome - currentExpense) / currentIncome) * 100)) : 0,
      },
      income: this.formatCurrency(currentIncome),
      incomeDiff: this.getPercentDelta(currentIncome, previousIncome),
      expense: this.formatCurrency(currentExpense),
      expenseDiff: this.getPercentDelta(currentExpense, previousExpense),
      balance: this.formatCurrency(currentNet),
      balanceDiff: this.getPercentDelta(currentNet, previousNet),
      savingsRate: currentIncome > 0 ? Math.max(0, Math.round(((currentIncome - currentExpense) / currentIncome) * 100)) : 0,
      savingsDiff: this.getPercentDelta(
        currentIncome > 0 ? ((currentIncome - currentExpense) / currentIncome) * 100 : 0,
        previousIncome > 0 ? ((previousIncome - previousExpense) / previousIncome) * 100 : 0,
      ),
      totalBudget,
      spent: currentExpense,
      remaining,
      spentPercent,
      currency: wallets[0]?.currency || 'VND',
    };
  }

  async getRecentTransactions(userId: string, limit: number) {
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: 'desc',
      },
      take: limit,
    });

    return transactions.map((transaction) => {
      const amount = this.toNumber(transaction.amount);
      const type = transaction.transactionType === 'INCOME' ? 'income' : 'expense';

      return {
        id: transaction.id,
        title: transaction.title,
        category: transaction.category?.name || 'Khac',
        icon: transaction.category?.icon || null,
        amount,
        currency: transaction.currency || 'VND',
        transactionDate: transaction.transactionDate.toISOString(),
        date: this.formatTransactionDate(transaction.transactionDate),
        type,
        iconUrl: null,
      };
    });
  }

  async getCategoryStats(userId: string, month: string) {
    const range = this.getMonthRange(month);
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionType: 'EXPENSE',
        transactionDate: {
          gte: range.start,
          lt: range.end,
        },
      },
      include: {
        category: true,
      },
    });

    const totalExpense = transactions.reduce((sum, transaction) => sum + this.toNumber(transaction.amount), 0);
    const categoryMap = new Map<string, { amount: number; categoryName: string; icon: string | null }>();

    for (const transaction of transactions) {
      const key = transaction.categoryId;
      const current = categoryMap.get(key) || {
        amount: 0,
        categoryName: transaction.category?.name || 'Khac',
        icon: transaction.category?.icon || null,
      };

      current.amount += this.toNumber(transaction.amount);
      categoryMap.set(key, current);
    }

    const items = Array.from(categoryMap.entries())
      .map(([categoryId, value]) => ({
        categoryId,
        categoryName: value.categoryName,
        icon: value.icon,
        amount: Math.round(value.amount),
        percent: totalExpense > 0 ? Math.round((value.amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { items };
  }

  async getAccounts(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ balance: 'desc' }, { createdAt: 'asc' }],
    });

    const primaryWalletId = wallets[0]?.id;

    return {
      accounts: wallets.map((wallet) => ({
        id: wallet.id,
        type: this.mapWalletType(wallet.walletType),
        name: wallet.name,
        balance: this.formatCurrency(this.toNumber(wallet.balance), wallet.currency),
        accountNumber: wallet.walletType === 'CASH' ? 'Vi tien mat' : `•••• ${wallet.id.slice(-4)}`,
        isPrimary: wallet.id === primaryWalletId,
      })),
    };
  }

  async getTrends(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const range = this.getMonthRange(month);
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: {
          gte: range.start,
          lt: range.end,
        },
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (const transaction of transactions) {
      const key = transaction.transactionDate.toISOString().slice(0, 10);
      const current = dailyMap.get(key) || { income: 0, expense: 0 };
      if (transaction.transactionType === 'INCOME') {
        current.income += this.toNumber(transaction.amount);
      } else {
        current.expense += this.toNumber(transaction.amount);
      }
      dailyMap.set(key, current);
    }

    const points: Array<{ date: string; income: number; expense: number }> = [];
    for (let cursor = new Date(range.start); cursor < range.end; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      const daily = dailyMap.get(key) || { income: 0, expense: 0 };
      points.push({
        date: this.formatShortDate(cursor),
        income: Math.round(daily.income / 1_000_000),
        expense: Math.round(daily.expense / 1_000_000),
      });
    }

    return points.length > 0 ? points : [
      { date: '01/01', income: 0, expense: 0 },
      { date: '02/01', income: 0, expense: 0 },
    ];
  }

  private buildAllocations(
    wallets: Array<{ id: string; name: string; walletType: string; currency: string; balance: unknown }>,
    totalBalance: number,
  ) {
    return wallets.map((wallet, index) => {
      const balance = this.toNumber(wallet.balance);
      const percent = totalBalance > 0 ? Math.round((balance / totalBalance) * 100) : 0;

      return {
        id: wallet.id,
        title: wallet.name,
        percent,
        amount: this.formatCurrency(balance, wallet.currency),
        color: this.getWalletColor(index),
        offset: this.getWalletOffset(index),
      };
    });
  }

  private getMonthRange(month: string): DateRange {
    const [year, monthValue] = month.split('-').map(Number);
    const start = new Date(year, monthValue - 1, 1);
    const end = new Date(year, monthValue, 1);
    return { start, end };
  }

  private getPreviousMonthRange(month: string): DateRange {
    const [year, monthValue] = month.split('-').map(Number);
    const start = new Date(year, monthValue - 2, 1);
    const end = new Date(year, monthValue - 1, 1);
    return { start, end };
  }

  private sumTransactionsByType(
    transactions: Array<{ amount: unknown; transactionType: string }>,
    type: 'INCOME' | 'EXPENSE',
  ) {
    return transactions
      .filter((transaction) => transaction.transactionType === type)
      .reduce((sum, transaction) => sum + this.toNumber(transaction.amount), 0);
  }

  private getPercentDelta(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    return Math.round(((current - previous) / Math.abs(previous)) * 100);
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value || 0);
  }

  private formatCurrency(value: number, currency = 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatSignedCurrency(value: number, currency = 'VND') {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${this.formatCurrency(Math.abs(value), currency)}`;
  }

  private formatTransactionDate(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private formatShortDate(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  }

  private mapWalletType(walletType: string) {
    const normalized = walletType.toUpperCase();
    if (normalized.includes('MB')) return 'mb';
    if (normalized.includes('MOMO')) return 'momo';
    if (normalized.includes('ZALO')) return 'zalopay';
    if (normalized.includes('CASH')) return 'cash';
    return 'cash';
  }

  private getWalletColor(index: number) {
    const colors = [
      'var(--color-yellow)',
      'var(--color-mint)',
      'var(--color-text-muted)',
      '#93C5FD',
      '#F9A8D4',
    ];
    return colors[index % colors.length];
  }

  private getWalletOffset(index: number) {
    const offsets = [-25, 0, -85, -45, -110];
    return offsets[index % offsets.length];
  }
}
