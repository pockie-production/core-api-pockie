import { ForbiddenException, Injectable } from '@nestjs/common';
import { ChatChannel, ChatRole, Prisma } from '@prisma/client';
import { VnptSmartbotService } from '../../integrations/vnpt-smartbot/vnpt-smartbot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { GamificationService } from '../gamification/gamification.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnptSmartbotService: VnptSmartbotService,
    private readonly financeService: FinanceService,
    private readonly gamificationService: GamificationService,
    private readonly usersService: UsersService,
  ) {}

  async getSessions(userId: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId,
        channel: ChatChannel.MAIN_CHAT,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      title: session.title || 'Cuoc tro chuyen moi',
      preview: session.messages[0]?.content || '',
      workspace:
        typeof session.metadata === 'object' && session.metadata && 'lastWorkspace' in (session.metadata as Record<string, unknown>)
          ? (session.metadata as Record<string, unknown>).lastWorkspace
          : 'none',
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
    }));
  }

  async createSession(userId: string) {
    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        channel: ChatChannel.MAIN_CHAT,
        title: 'Cuoc tro chuyen moi',
        metadata: {
          source: 'pockie-user-web',
        },
      },
    });

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async getSessionMessages(userId: string, sessionId: string) {
    const session = await this.getOwnedSession(userId, sessionId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    return {
      session: {
        id: session.id,
        title: session.title || 'Cuoc tro chuyen moi',
        workspace:
          typeof session.metadata === 'object' && session.metadata && 'lastWorkspace' in (session.metadata as Record<string, unknown>)
            ? (session.metadata as Record<string, unknown>).lastWorkspace
            : 'none',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: this.mapChatRole(message.role),
        content: message.content,
        metadata: message.metadata,
        createdAt: message.createdAt,
      })),
    };
  }

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

  async chat(userId: string, message: string, sessionId?: string) {
    const session = sessionId
      ? await this.getOwnedSession(userId, sessionId)
      : await this.createOrReuseLatestSession(userId);

    return this.chatInSession(userId, session.id, message);
  }

  async chatInSession(userId: string, sessionId: string, message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return {
        sessionId,
        workspace: 'none',
        reply: 'Hay gui mot noi dung cu the hon de toi co the ho tro ban.',
      };
    }

    const session = await this.getOwnedSession(userId, sessionId);
    const workspace = this.detectWorkspace(trimmedMessage);
    const title =
      session.title && session.title !== 'Cuoc tro chuyen moi'
        ? session.title
        : this.buildSessionTitle(trimmedMessage);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.USER,
        content: trimmedMessage,
      },
    });

    const smartbotResponse = await this.vnptSmartbotService.sendMessage({
      senderId: userId,
      sessionId: session.id,
      text: trimmedMessage,
      metadata: {
        source: 'pockie-user-web',
        userId,
        sessionId: session.id,
      },
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: smartbotResponse.replyText,
        metadata: {
          provider: 'vnpt-smartbot',
          cardData: smartbotResponse.cardData,
          raw: smartbotResponse.raw,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: {
        title,
        metadata: {
          ...(typeof session.metadata === 'object' && session.metadata ? (session.metadata as Record<string, unknown>) : {}),
          source: 'pockie-user-web',
          lastWorkspace: workspace,
          smartbotBotId: process.env.VNPT_SMARTBOT_BOT_ID || '',
        },
      },
    });

    return {
      sessionId: session.id,
      workspace,
      reply: assistantMessage.content,
      userMessage: {
        id: userMessage.id,
        role: this.mapChatRole(userMessage.role),
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      message: {
        id: assistantMessage.id,
        role: this.mapChatRole(assistantMessage.role),
        content: assistantMessage.content,
        metadata: assistantMessage.metadata,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  private detectWorkspace(message: string) {
    const lowerInput = message.trim().toLowerCase();

    if (
      lowerInput.includes('bao cao') ||
      lowerInput.includes('phan tich') ||
      lowerInput.includes('chi tieu')
    ) {
      return 'reports';
    }

    if (
      lowerInput.includes('vi') ||
      lowerInput.includes('tai san') ||
      lowerInput.includes('so du')
    ) {
      return 'wallet';
    }

    if (
      lowerInput.includes('muc tieu') ||
      lowerInput.includes('tiet kiem') ||
      lowerInput.includes('ke hoach')
    ) {
      return 'goals';
    }

    if (
      lowerInput.includes('cai dat') ||
      lowerInput.includes('tai khoan') ||
      lowerInput.includes('mat khau')
    ) {
      return 'settings';
    }

    return 'none';
  }

  private async createOrReuseLatestSession(userId: string) {
    const existing = await this.prisma.chatSession.findFirst({
      where: {
        userId,
        channel: ChatChannel.MAIN_CHAT,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    const created = await this.createSession(userId);
    return this.getOwnedSession(userId, created.id);
  }

  private async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        channel: ChatChannel.MAIN_CHAT,
      },
    });

    if (!session) {
      throw new ForbiddenException('Chat session not found');
    }

    return session;
  }

  private buildSessionTitle(message: string) {
    const normalized = message.replace(/\s+/g, ' ').trim();
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
  }

  private mapChatRole(role: ChatRole) {
    return role.toLowerCase();
  }

  private formatCurrency(value: number, currency = 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
