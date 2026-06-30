import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletsOverview(userId: string, month: string) {
    return {
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
      { id: '1', title: 'Highlands Coffee', date: 'Hôm nay, 08:30', amount: '-55.000đ', type: 'expense', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Hot%20beverage/3D/hot_beverage_3d.png' },
      { id: '2', title: 'Lương tháng 4', date: 'Hôm qua, 15:00', amount: '+15.500.000đ', type: 'income', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Money%20bag/3D/money_bag_3d.png' },
      { id: '3', title: 'Shopee', date: '12/04/2024, 20:15', amount: '-340.000đ', type: 'expense', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20bags/3D/shopping_bags_3d.png' },
      { id: '4', title: 'GrabBike', date: '12/04/2024, 08:15', amount: '-25.000đ', type: 'expense', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Oncoming%20bus/3D/oncoming_bus_3d.png' },
      { id: '5', title: 'Spotify Premium', date: '10/04/2024, 09:00', amount: '-59.000đ', type: 'expense', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Headphone/3D/headphone_3d.png' },
    ];
  }

  async getCategoryStats(userId: string, month: string) {
    return [
      { id: 'food', name: 'Ăn uống', percent: 38, amount: '3.743.000đ', color: '#A7F3D0', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Hamburger/3D/hamburger_3d.png' },
      { id: 'shopping', name: 'Mua sắm', percent: 20, amount: '1.970.000đ', color: '#BAE6FD', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20bags/3D/shopping_bags_3d.png' },
      { id: 'transport', name: 'Đi lại', percent: 15, amount: '1.478.000đ', color: '#FED7AA', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Oncoming%20bus/3D/oncoming_bus_3d.png' },
      { id: 'entertainment', name: 'Giải trí', percent: 10, amount: '985.000đ', color: '#C7D2FE', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Video%20game/3D/video_game_3d.png' },
      { id: 'bills', name: 'Hóa đơn', percent: 8, amount: '788.000đ', color: '#FEF08A', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Receipt/3D/receipt_3d.png' },
      { id: 'other', name: 'Khác', percent: 9, amount: '886.000đ', color: '#E5E7EB', iconUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Package/3D/package_3d.png' }
    ];
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

