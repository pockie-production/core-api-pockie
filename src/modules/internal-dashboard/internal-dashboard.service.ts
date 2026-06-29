import { Injectable } from '@nestjs/common';
import { Prisma, TrendStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../integrations/minio/minio.service';

type QueueSeverity = 'info' | 'success' | 'warning' | 'danger';
type ServiceStatus = 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

@Injectable()
export class InternalDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  async getOverview() {
    const now = new Date();
    const startToday = this.startOfDay(now);
    const startYesterday = this.shiftDays(startToday, -1);
    const startTomorrow = this.shiftDays(startToday, 1);
    const startLast7Days = this.shiftDays(startToday, -6);
    const startPrevious7Days = this.shiftDays(startLast7Days, -7);
    const expiringSoonThreshold = this.shiftDays(startToday, 3);

    const [
      totalUsers,
      newUsersToday,
      newUsersYesterday,
      newUsersLast7Days,
      newUsersPrevious7Days,
      totalVerifiedUsers,
      verifiedUsersLast7Days,
      verifiedUsersPrevious7Days,
      reviewRequiredCount,
      reviewRequiredToday,
      reviewRequiredYesterday,
      chatSessionsToday,
      chatSessionsYesterday,
      ocrJobsToday,
      ocrJobsYesterday,
      pendingTrends,
      pendingTrendsToday,
      pendingTrendsYesterday,
      activeVouchers,
      activeVouchersYesterday,
      userGrowth,
      ekycReviewQueue,
      trendQueue,
      expiringVoucherQueue,
      systemIssueQueue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startToday, lt: startTomorrow } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startLast7Days, lt: startTomorrow } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startPrevious7Days, lt: startLast7Days } } }),
      this.prisma.user.count({ where: { kycStatus: 'VERIFIED' } }),
      this.prisma.user.count({
        where: { kycStatus: 'VERIFIED', updatedAt: { gte: startLast7Days, lt: startTomorrow } },
      }),
      this.prisma.user.count({
        where: { kycStatus: 'VERIFIED', updatedAt: { gte: startPrevious7Days, lt: startLast7Days } },
      }),
      this.prisma.ekycSession.count({ where: { status: 'REVIEW_REQUIRED' } }),
      this.prisma.ekycSession.count({
        where: { status: 'REVIEW_REQUIRED', updatedAt: { gte: startToday, lt: startTomorrow } },
      }),
      this.prisma.ekycSession.count({
        where: { status: 'REVIEW_REQUIRED', updatedAt: { gte: startYesterday, lt: startToday } },
      }),
      this.prisma.chatSession.count({ where: { createdAt: { gte: startToday, lt: startTomorrow } } }),
      this.prisma.chatSession.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
      this.prisma.ocrJob.count({ where: { createdAt: { gte: startToday, lt: startTomorrow } } }),
      this.prisma.ocrJob.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
      this.prisma.trend.count({ where: { status: TrendStatus.PENDING_REVIEW } }),
      this.prisma.trend.count({
        where: { status: TrendStatus.PENDING_REVIEW, createdAt: { gte: startToday, lt: startTomorrow } },
      }),
      this.prisma.trend.count({
        where: { status: TrendStatus.PENDING_REVIEW, createdAt: { gte: startYesterday, lt: startToday } },
      }),
      this.countActiveVouchers(now),
      this.countActiveVouchers(startYesterday),
      this.getUserGrowthSeries(startLast7Days, startTomorrow),
      this.prisma.ekycSession.findMany({
        where: { status: 'REVIEW_REQUIRED' },
        include: { user: { include: { profile: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.trend.findMany({
        where: { status: TrendStatus.PENDING_REVIEW },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.voucher.findMany({
        where: {
          endsAt: { gte: now, lte: expiringSoonThreshold },
          OR: [
            { remainingQuantity: null },
            { remainingQuantity: { gt: 0 } },
          ],
        },
        orderBy: { endsAt: 'asc' },
        take: 5,
      }),
      this.prisma.ekycProviderRequest.findMany({
        where: {
          createdAt: { gte: startYesterday },
          OR: [
            { errorMessage: { not: null } },
            { statusCode: { gte: 400 } },
            { durationMs: { gte: 3000 } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      lastUpdatedAt: now.toISOString(),
      metrics: {
        totalUsers: {
          value: totalUsers,
          deltaPercent: this.percentChange(newUsersLast7Days, newUsersPrevious7Days),
          deltaLabel: 'new users vs previous 7 days',
        },
        newUsersToday: {
          value: newUsersToday,
          deltaPercent: this.percentChange(newUsersToday, newUsersYesterday),
          deltaLabel: 'vs yesterday',
        },
        ekycVerified: {
          value: totalVerifiedUsers,
          deltaPercent: this.percentChange(verifiedUsersLast7Days, verifiedUsersPrevious7Days),
          deltaLabel: 'verified users vs previous 7 days',
        },
        ekycReviewRequired: {
          value: reviewRequiredCount,
          deltaPercent: this.percentChange(reviewRequiredToday, reviewRequiredYesterday),
          deltaLabel: 'new review cases vs yesterday',
        },
        chatSessionsToday: {
          value: chatSessionsToday,
          deltaPercent: this.percentChange(chatSessionsToday, chatSessionsYesterday),
          deltaLabel: 'vs yesterday',
        },
        ocrJobsToday: {
          value: ocrJobsToday,
          deltaPercent: this.percentChange(ocrJobsToday, ocrJobsYesterday),
          deltaLabel: 'vs yesterday',
        },
        pendingTrends: {
          value: pendingTrends,
          deltaPercent: this.percentChange(pendingTrendsToday, pendingTrendsYesterday),
          deltaLabel: 'new pending trends vs yesterday',
        },
        activeVouchers: {
          value: activeVouchers,
          deltaPercent: this.percentChange(activeVouchers, activeVouchersYesterday),
          deltaLabel: 'active now vs yesterday',
        },
      },
      userGrowth,
      queues: {
        ekycReview: ekycReviewQueue.map((session) => ({
          id: session.id,
          title: session.user.profile?.displayName || session.user.profile?.fullName || session.user.email || session.user.id,
          subtitle: session.decisionReason || `Risk: ${session.riskLevel}`,
          status: session.status,
          severity: this.mapEkycSeverity(session.riskLevel),
          createdAt: session.updatedAt.toISOString(),
          actionLabel: 'Review',
          actionHref: `/ekyc-review/${session.id}`,
        })),
        pendingTrends: trendQueue.map((trend) => ({
          id: trend.id,
          title: trend.title,
          subtitle: `Category: ${trend.category || 'Unknown'}${trend.score !== null && trend.score !== undefined ? ` • Score: ${Math.round(trend.score)}` : ''}`,
          status: trend.status,
          severity: 'info' as QueueSeverity,
          createdAt: trend.createdAt.toISOString(),
          actionLabel: 'Open',
          actionHref: '/trends',
        })),
        expiringVouchers: expiringVoucherQueue.map((voucher) => ({
          id: voucher.id,
          title: voucher.title,
          subtitle: voucher.endsAt ? `Expires ${this.formatRelativeDays(voucher.endsAt, now)}` : 'No expiry date',
          status: 'EXPIRING_SOON',
          severity: 'warning' as QueueSeverity,
          createdAt: voucher.createdAt.toISOString(),
          actionLabel: 'View',
          actionHref: '/vouchers',
        })),
        systemIssues: systemIssueQueue.map((issue) => ({
          id: issue.id,
          title: this.labelProviderIssue(issue.apiName),
          subtitle: issue.errorMessage || issue.message || `Status ${issue.statusCode || 'unknown'} • ${issue.durationMs || 0}ms`,
          status: issue.statusCode && issue.statusCode >= 400 ? 'ERROR' : 'DEGRADED',
          severity: issue.statusCode && issue.statusCode >= 400 ? 'danger' : 'warning',
          createdAt: issue.createdAt.toISOString(),
          actionLabel: 'Inspect',
          actionHref: '/analytics',
        })),
      },
    };
  }

  async getEkycFunnel() {
    const [
      registered,
      startedEkyc,
      submittedDocuments,
      ocrSuccess,
      livenessSuccess,
      faceMatch,
      verified,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.ekycSession.groupBy({
        by: ['userId'],
        _count: { userId: true },
      }).then((rows) => rows.length),
      this.prisma.ekycSession.count({
        where: {
          documents: {
            some: {},
          },
        },
      }),
      this.prisma.ekycOcrResult.count({
        where: { statusCode: 200 },
      }),
      this.prisma.ekycSession.count({
        where: {
          livenessCard: {
            is: {
              liveness: { not: 'failure' },
              faceSwapping: false,
              fakeLiveness: false,
              fakePrintPhoto: false,
            },
          },
          faceLiveness: {
            is: {
              liveness: { not: 'failure' },
              multipleFaces: false,
            },
          },
        },
      }),
      this.prisma.ekycFaceCompareResult.count({
        where: {
          msg: { not: 'NOMATCH' },
        },
      }),
      this.prisma.ekycSession.count({
        where: { status: 'VERIFIED' },
      }),
    ]);

    return {
      stages: [
        { key: 'registered', label: 'Registered', value: registered },
        { key: 'started_ekyc', label: 'Started eKYC', value: startedEkyc },
        { key: 'submitted_documents', label: 'Submitted Documents', value: submittedDocuments },
        { key: 'ocr_success', label: 'OCR Success', value: ocrSuccess },
        { key: 'liveness_success', label: 'Liveness Success', value: livenessSuccess },
        { key: 'face_match', label: 'Face Match', value: faceMatch },
        { key: 'verified', label: 'Verified', value: verified },
      ],
    };
  }

  async getFeatureUsage() {
    const start30DaysAgo = this.shiftDays(this.startOfDay(new Date()), -29);
    const featureKeys = [
      { key: 'chat', label: 'Chat' },
      { key: 'ocr', label: 'OCR' },
      { key: 'finance_dashboard', label: 'Finance Dashboard' },
      { key: 'pet', label: 'Pet' },
      { key: 'voucher', label: 'Voucher' },
      { key: 'streak', label: 'Streak' },
    ];

    const grouped = await this.prisma.analyticsEvent.groupBy({
      by: ['feature'],
      where: {
        createdAt: { gte: start30DaysAgo },
        feature: {
          in: featureKeys.map((item) => item.key),
        },
      },
      _count: { feature: true },
    });

    const countMap = new Map(grouped.map((item) => [item.feature || '', item._count.feature]));

    return {
      features: featureKeys.map((item) => ({
        key: item.key,
        label: item.label,
        value: countMap.get(item.key) || 0,
      })),
    };
  }

  async getSystemHealth() {
    const now = new Date();
    const start24HoursAgo = this.shiftDays(now, -1);
    const healthStart = Date.now();

    const database = await this.measureDatabaseHealth();
    const minio = await this.measureMinioHealth();
    const [vnptEkyc, vnptOcr, smartbot] = await Promise.all([
      this.measureProviderHealth(['UPLOAD_FILE', 'LIVENESS_CARD', 'FACE_LIVENESS_2D', 'FACE_COMPARE'], 'VNPT eKYC', start24HoursAgo),
      this.measureProviderHealth(['OCR_ID'], 'VNPT OCR', start24HoursAgo),
      this.measureAnalyticsBackedHealth('smartbot', 'VNPT SmartBot', start24HoursAgo),
    ]);

    return {
      services: [
        {
          key: 'api',
          label: 'Core API',
          status: 'OK' as ServiceStatus,
          latencyMs: Math.max(1, Date.now() - healthStart),
          message: 'Operational',
        },
        database,
        vnptEkyc,
        vnptOcr,
        smartbot,
        minio,
      ],
    };
  }

  private async countActiveVouchers(referenceDate: Date) {
    return this.prisma.voucher.count({
      where: {
        AND: [
          {
            OR: [
              { startsAt: null },
              { startsAt: { lte: referenceDate } },
            ],
          },
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: referenceDate } },
            ],
          },
          {
            OR: [
              { remainingQuantity: null },
              { remainingQuantity: { gt: 0 } },
            ],
          },
        ],
      },
    });
  }

  private async getUserGrowthSeries(start: Date, end: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ date: string; users: bigint }>>(Prisma.sql`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::bigint AS users
      FROM "User"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `);

    const countMap = new Map(rows.map((row) => [row.date, Number(row.users)]));
    const result: Array<{ date: string; users: number }> = [];

    for (let cursor = new Date(start); cursor < end; cursor = this.shiftDays(cursor, 1)) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({
        date: key,
        users: countMap.get(key) || 0,
      });
    }

    return result;
  }

  private async measureDatabaseHealth() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        key: 'database',
        label: 'PostgreSQL',
        status: 'OK' as ServiceStatus,
        latencyMs: Date.now() - startedAt,
        message: 'Operational',
      };
    } catch (error) {
      return {
        key: 'database',
        label: 'PostgreSQL',
        status: 'DOWN' as ServiceStatus,
        latencyMs: Date.now() - startedAt,
        message: 'Database unreachable',
      };
    }
  }

  private async measureMinioHealth() {
    const startedAt = Date.now();

    try {
      await this.minioService.getFileUrl('__healthcheck_missing_object__');
      return {
        key: 'minio',
        label: 'MinIO',
        status: 'OK' as ServiceStatus,
        latencyMs: Date.now() - startedAt,
        message: 'Operational',
      };
    } catch (error: any) {
      const message = String(error?.message || '');
      const isReachable = message.length > 0 && !message.toLowerCase().includes('connect');

      return {
        key: 'minio',
        label: 'MinIO',
        status: isReachable ? ('OK' as ServiceStatus) : ('DOWN' as ServiceStatus),
        latencyMs: Date.now() - startedAt,
        message: isReachable ? 'Operational' : 'MinIO unreachable',
      };
    }
  }

  private async measureProviderHealth(apiNames: string[], label: string, since: Date) {
    const requests = await this.prisma.ekycProviderRequest.findMany({
      where: {
        apiName: { in: apiNames as any[] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        statusCode: true,
        durationMs: true,
        errorMessage: true,
      },
    });

    if (requests.length === 0) {
      return {
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        status: 'UNKNOWN' as ServiceStatus,
        latencyMs: 0,
        message: 'No telemetry yet',
      };
    }

    const avgLatency = Math.round(
      requests.reduce((sum, item) => sum + (item.durationMs || 0), 0) / requests.length,
    );
    const errorCount = requests.filter(
      (item) => item.errorMessage || (item.statusCode !== null && item.statusCode !== undefined && item.statusCode >= 400),
    ).length;

    let status: ServiceStatus = 'OK';
    let message = 'Operational';

    if (errorCount > 0 || avgLatency >= 3000) {
      status = errorCount > requests.length / 2 ? 'DOWN' : 'DEGRADED';
      message = errorCount > 0 ? `${errorCount} issue(s) in last 24h` : 'High latency';
    }

    return {
      key: label.toLowerCase().replace(/\s+/g, '_'),
      label,
      status,
      latencyMs: avgLatency,
      message,
    };
  }

  private async measureAnalyticsBackedHealth(feature: string, label: string, since: Date) {
    const events = await this.prisma.analyticsEvent.count({
      where: {
        createdAt: { gte: since },
        feature,
      },
    });

    return {
      key: feature,
      label,
      status: events > 0 ? ('OK' as ServiceStatus) : ('UNKNOWN' as ServiceStatus),
      latencyMs: 0,
      message: events > 0 ? `${events} events in last 24h` : 'No telemetry yet',
    };
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private shiftDays(date: Date, delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
  }

  private percentChange(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private mapEkycSeverity(riskLevel: string): QueueSeverity {
    switch (riskLevel) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
      case 'CRITICAL':
        return 'danger';
      default:
        return 'info';
    }
  }

  private labelProviderIssue(apiName: string) {
    switch (apiName) {
      case 'OCR_ID':
        return 'VNPT OCR issue';
      case 'UPLOAD_FILE':
        return 'VNPT upload issue';
      case 'LIVENESS_CARD':
        return 'VNPT card liveness issue';
      case 'FACE_LIVENESS_2D':
        return 'VNPT face liveness issue';
      case 'FACE_COMPARE':
        return 'VNPT face compare issue';
      default:
        return apiName;
    }
  }

  private formatRelativeDays(targetDate: Date, referenceDate: Date) {
    const diffMs = targetDate.getTime() - referenceDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'in 1 day';
    return `in ${diffDays} days`;
  }
}
