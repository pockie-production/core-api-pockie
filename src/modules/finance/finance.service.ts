import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletsOverview(userId: string, month: string) {
    return {
      month,
      // For Wallet/index.tsx
      allocations: [
        { id: 'bank', title: 'Ngân hàng', percent: 60, amount: '3.912.000đ', color: 'var(--color-yellow)', offset: -25 },
        { id: 'cash', title: 'Tiền mặt', percent: 25, amount: '1.630.000đ', color: 'var(--color-mint)', offset: 0 },
        { id: 'ewallet', title: 'Ví điện tử', percent: 15, amount: '978.000đ', color: 'var(--color-text-muted)', offset: -85 }
      ],
      summary: {
        balance: '6.520.000đ',
        diffAmount: '+850.000đ',
        diffType: 'up',
        income: '4.500.000đ',
        expense: '3.650.000đ',
        savingsPercent: 19
      },
      // For Reports/index.tsx
      income: '15.240.000đ', incomeDiff: 12,
      expense: '9.850.000đ', expenseDiff: 8,
      balance: '5.390.000đ', balanceDiff: 18,
      savingsRate: 35, savingsDiff: 5,
      // For insights.service.ts
      totalBudget: 15000000,
      spent: 9850000,
      remaining: 5150000,
      spentPercent: 65,
      currency: 'VND'
    };
  }

  async getRecentTransactions(userId: string, limit: number) {
    return [
      {
        id: '1',
        title: 'Highlands Coffee',
        category: 'Ăn uống',
        icon: null,
        amount: 55000,
        currency: 'VND',
        transactionDate: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Lương tháng 4',
        category: 'Thu nhập',
        icon: null,
        amount: 15500000,
        currency: 'VND',
        transactionDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Shopee',
        category: 'Mua sắm',
        icon: null,
        amount: 340000,
        currency: 'VND',
        transactionDate: new Date('2024-04-12T20:15:00+07:00').toISOString(),
      },
      {
        id: '4',
        title: 'GrabBike',
        category: 'Đi lại',
        icon: null,
        amount: 25000,
        currency: 'VND',
        transactionDate: new Date('2024-04-12T08:15:00+07:00').toISOString(),
      },
      {
        id: '5',
        title: 'Spotify Premium',
        category: 'Giải trí',
        icon: null,
        amount: 59000,
        currency: 'VND',
        transactionDate: new Date('2024-04-10T09:00:00+07:00').toISOString(),
      },
    ].slice(0, limit);
  }

  async getCategoryStats(userId: string, month: string) {
    return {
      items: [
        { categoryId: 'food', categoryName: 'Ăn uống', icon: '🍔', percent: 38, amount: 3743000 },
        { categoryId: 'shopping', categoryName: 'Mua sắm', icon: '🛍️', percent: 20, amount: 1970000 },
        { categoryId: 'transport', categoryName: 'Đi lại', icon: '🚌', percent: 15, amount: 1478000 },
        { categoryId: 'entertainment', categoryName: 'Giải trí', icon: '🎮', percent: 10, amount: 985000 },
        { categoryId: 'bills', categoryName: 'Hóa đơn', icon: '🧾', percent: 8, amount: 788000 },
        { categoryId: 'other', categoryName: 'Khác', icon: '📦', percent: 9, amount: 886000 }
      ]
    };
  }

  async getAccounts(userId: string) {
    return {
      accounts: [
        { id: 'w1', type: 'mb', name: 'MB Bank', balance: '3.200.000đ', accountNumber: '•••• 0897', isPrimary: true },
        { id: 'w2', type: 'momo', name: 'Ví MoMo', balance: '520.000đ', accountNumber: '•••• 1234', isPrimary: false },
        { id: 'w3', type: 'zalopay', name: 'ZaloPay', balance: '340.000đ', accountNumber: '•••• 4321', isPrimary: false },
        { id: 'w4', type: 'cash', name: 'Tiền mặt', balance: '1.500.000đ', accountNumber: 'Ví tiền mặt', isPrimary: false }
      ]
    };
  }

  async getTrends(userId: string) {
    return [
      { date: '01/05', income: 12, expense: 9 },
      { date: '04/05', income: 14, expense: 8 },
      { date: '08/05', income: 13, expense: 10 },
      { date: '12/05', income: 15, expense: 7 },
      { date: '16/05', income: 20, expense: 6 },
      { date: '20/05', income: 14, expense: 8 },
      { date: '24/05', income: 11, expense: 4 },
      { date: '28/05', income: 14, expense: 7 },
      { date: '31/05', income: 16, expense: 8 },
    ];
  }
}
