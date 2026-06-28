import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalDashboardService {
  async getOverview() {
    return {
      lastUpdatedAt: new Date().toISOString(),
      metrics: {
        totalUsers: {
          value: 12450,
          deltaPercent: 8.2,
          deltaLabel: 'vs last 7 days',
        },
        newUsersToday: {
          value: 184,
          deltaPercent: 3.1,
          deltaLabel: 'vs yesterday',
        },
        ekycVerified: {
          value: 8920,
          deltaPercent: 6.4,
          deltaLabel: 'vs last 7 days',
        },
        ekycReviewRequired: {
          value: 37,
          deltaPercent: -2.5,
          deltaLabel: 'vs yesterday',
        },
        chatSessionsToday: {
          value: 3210,
          deltaPercent: 12.0,
          deltaLabel: 'vs yesterday',
        },
        ocrJobsToday: {
          value: 640,
          deltaPercent: 4.8,
          deltaLabel: 'vs yesterday',
        },
        pendingTrends: {
          value: 16,
          deltaPercent: 0,
          deltaLabel: 'pending approval',
        },
        activeVouchers: {
          value: 24,
          deltaPercent: 5.0,
          deltaLabel: 'active now',
        },
      },
      userGrowth: [
        { date: '2026-06-22', users: 120 },
        { date: '2026-06-23', users: 140 },
        { date: '2026-06-24', users: 180 },
        { date: '2026-06-25', users: 160 },
        { date: '2026-06-26', users: 210 },
        { date: '2026-06-27', users: 240 },
        { date: '2026-06-28', users: 184 },
      ],
      queues: {
        ekycReview: [
          {
            id: 'ekyc_001',
            title: 'Nguyễn Văn A',
            subtitle: 'Face compare warning, needs review',
            status: 'REVIEW_REQUIRED',
            severity: 'warning',
            createdAt: '2026-06-28T09:00:00.000Z',
            actionLabel: 'Review',
            actionHref: '/ekyc-review',
          },
        ],
        pendingTrends: [
          {
            id: 'trend_001',
            title: 'Du lịch hè tăng mạnh',
            subtitle: 'Category: Travel • Score: 89',
            status: 'PENDING_REVIEW',
            severity: 'info',
            createdAt: '2026-06-28T08:40:00.000Z',
            actionLabel: 'Open',
            actionHref: '/trends',
          },
        ],
        expiringVouchers: [
          {
            id: 'voucher_001',
            title: 'Cashback 50K',
            subtitle: 'Expires in 2 days',
            status: 'EXPIRING_SOON',
            severity: 'warning',
            createdAt: '2026-06-26T08:00:00.000Z',
            actionLabel: 'View',
            actionHref: '/vouchers',
          },
        ],
        systemIssues: [
          {
            id: 'issue_001',
            title: 'VNPT OCR latency high',
            subtitle: 'Average response time > 3s',
            status: 'DEGRADED',
            severity: 'warning',
            createdAt: '2026-06-28T09:45:00.000Z',
            actionLabel: 'Inspect',
            actionHref: '/analytics',
          },
        ],
      },
    };
  }

  async getEkycFunnel() {
    return {
      stages: [
        { key: 'registered', label: 'Registered', value: 12450 },
        { key: 'started_ekyc', label: 'Started eKYC', value: 9300 },
        { key: 'submitted_documents', label: 'Submitted Documents', value: 9100 },
        { key: 'ocr_success', label: 'OCR Success', value: 8950 },
        { key: 'liveness_success', label: 'Liveness Success', value: 8840 },
        { key: 'face_match', label: 'Face Match', value: 8760 },
        { key: 'verified', label: 'Verified', value: 8700 },
      ],
    };
  }

  async getFeatureUsage() {
    return {
      features: [
        { key: 'chat', label: 'Chat', value: 3210 },
        { key: 'ocr', label: 'OCR', value: 640 },
        { key: 'finance_dashboard', label: 'Finance Dashboard', value: 2100 },
        { key: 'pet', label: 'Pet', value: 870 },
        { key: 'voucher', label: 'Voucher', value: 430 },
        { key: 'streak', label: 'Streak', value: 1100 },
      ],
    };
  }

  async getSystemHealth() {
    return {
      services: [
        { key: 'api', label: 'Core API', status: 'OK', latencyMs: 45, message: 'Operational' },
        { key: 'database', label: 'PostgreSQL', status: 'OK', latencyMs: 12, message: 'Operational' },
        { key: 'vnpt_ekyc', label: 'VNPT eKYC', status: 'OK', latencyMs: 820, message: 'Operational' },
        { key: 'vnpt_ocr', label: 'VNPT OCR', status: 'DEGRADED', latencyMs: 3200, message: 'High latency' },
        { key: 'smartbot', label: 'VNPT SmartBot', status: 'OK', latencyMs: 760, message: 'Operational' },
        { key: 'minio', label: 'MinIO', status: 'OK', latencyMs: 30, message: 'Operational' },
      ],
    };
  }
}
