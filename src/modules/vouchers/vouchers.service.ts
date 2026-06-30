import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  KycStatus,
  Prisma,
  Voucher,
  VoucherClaimAttemptResult,
  VoucherClaimScope,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

class VoucherClaimRuleError extends Error {
  constructor(
    readonly result: VoucherClaimAttemptResult,
    readonly messageText: string,
  ) {
    super(messageText);
  }
}

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailableVouchers(userId: string) {
    const now = new Date();
    const [user, vouchers] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          kycStatus: true,
          verifiedIdentityId: true,
        },
      }),
      this.prisma.voucher.findMany({
        where: {
          approvalStatus: 'APPROVED',
          AND: [
            {
              OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            },
            {
              OR: [{ endsAt: null }, { endsAt: { gte: now } }],
            },
            {
              OR: [{ remainingQuantity: null }, { remainingQuantity: { gt: 0 } }],
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return Promise.all(
      vouchers.map(async (voucher) => {
        const eligibility = await this.evaluateVoucherEligibility(
          this.prisma,
          user.id,
          user.kycStatus,
          user.verifiedIdentityId,
          voucher,
        );

        return {
          ...voucher,
          canClaim: eligibility.canClaim,
          claimBlockedReason: eligibility.reason,
        };
      }),
    );
  }

  // --- ADMIN API ---

  async listVouchersForAdmin(params?: { skip?: number; take?: number; search?: string; status?: string }) {
    const { skip = 0, take = 20, search, status } = params || {};
    const where: Prisma.VoucherWhereInput = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.approvalStatus = status as any;
    }
    
    const [total, items] = await Promise.all([
      this.prisma.voucher.count({ where }),
      this.prisma.voucher.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    
    return { total, items };
  }

  async createVoucher(data: Prisma.VoucherCreateInput, creatorId: string) {
    if (data.campaignKey === '') data.campaignKey = null;
    if (data.claimScope === 'PER_CAMPAIGN_IDENTITY' && !data.campaignKey) {
      throw new BadRequestException('campaignKey is required when claimScope is PER_CAMPAIGN_IDENTITY');
    }
    return this.prisma.voucher.create({
      data: {
        ...data,
        remainingQuantity: data.totalQuantity ?? data.remainingQuantity,
        approvalStatus: 'PENDING',
      },
    });
  }

  async updateVoucher(id: string, data: Prisma.VoucherUpdateInput, updaterId: string) {
    if (data.campaignKey === '') data.campaignKey = null;
    // If it's updated, it goes back to pending
    return this.prisma.voucher.update({
      where: { id },
      data: {
        ...data,
        approvalStatus: 'PENDING',
      },
    });
  }

  async approveVoucher(id: string, checkerId: string) {
    return this.prisma.voucher.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: checkerId,
      },
    });
  }

  async rejectVoucher(id: string, checkerId: string) {
    return this.prisma.voucher.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: checkerId,
      },
    });
  }

  // --- END ADMIN API ---

  async listMyClaims(userId: string) {
    return this.prisma.voucherClaim.findMany({
      where: { userId },
      include: {
        voucher: true,
      },
      orderBy: { claimedAt: 'desc' },
    });
  }

  async claimVoucher(userId: string, voucherId: string, context: { ipAddress?: string; userAgent?: string }) {
    const baseUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        verifiedIdentityId: true,
      },
    });

    if (!baseUser) {
      throw new NotFoundException('User not found');
    }

    try {
      const claim = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            kycStatus: true,
            verifiedIdentityId: true,
          },
        });

        const voucher = await tx.voucher.findUnique({
          where: { id: voucherId },
        });

        if (!user || !voucher) {
          throw new NotFoundException('Voucher not found');
        }

        const eligibility = await this.evaluateVoucherEligibility(
          tx,
          user.id,
          user.kycStatus,
          user.verifiedIdentityId,
          voucher,
        );

        if (!eligibility.canClaim) {
          throw new VoucherClaimRuleError(
            eligibility.result,
            eligibility.reason ?? 'Voucher cannot be claimed',
          );
        }

        const voucherUpdateResult = voucher.remainingQuantity == null
          ? { count: 1 }
          : await tx.voucher.updateMany({
              where: {
                id: voucher.id,
                remainingQuantity: { gt: 0 },
              },
              data: {
                remainingQuantity: {
                  decrement: 1,
                },
              },
            });

        if (voucher.remainingQuantity != null && voucherUpdateResult.count === 0) {
          throw new VoucherClaimRuleError(
            VoucherClaimAttemptResult.REJECTED_OUT_OF_STOCK,
            'Voucher đã hết lượt nhận.',
          );
        }

        if (
          voucher.claimScope === VoucherClaimScope.PER_CAMPAIGN_IDENTITY &&
          user.verifiedIdentityId &&
          voucher.campaignKey
        ) {
          await tx.voucherCampaignIdentityLock.create({
            data: {
              campaignKey: voucher.campaignKey,
              verifiedIdentityId: user.verifiedIdentityId,
              voucherId: voucher.id,
              userId: user.id,
            },
          });
        }

        const createdClaim = await tx.voucherClaim.create({
          data: {
            voucherId: voucher.id,
            userId: user.id,
            verifiedIdentityId: user.verifiedIdentityId,
            campaignKey: voucher.campaignKey,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            metadata: {
              claimScope: voucher.claimScope,
              requiresKyc: voucher.requiresKyc,
            },
          },
          include: {
            voucher: true,
          },
        });

        await tx.voucherClaimAttempt.create({
          data: {
            voucherId: voucher.id,
            userId: user.id,
            verifiedIdentityId: user.verifiedIdentityId,
            result: VoucherClaimAttemptResult.SUCCESS,
            reason: 'Voucher claimed successfully',
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            metadata: {
              claimScope: voucher.claimScope,
            },
          },
        });

        return createdClaim;
      });

      return {
        message: 'Nhận voucher thành công.',
        claim,
      };
    } catch (error) {
      if (error instanceof VoucherClaimRuleError) {
        await this.recordClaimAttempt(
          baseUser,
          voucherId,
          error.result,
          error.messageText,
          context,
        );

        if (
          error.result === VoucherClaimAttemptResult.REJECTED_NOT_VERIFIED ||
          error.result === VoucherClaimAttemptResult.REJECTED_NO_VERIFIED_IDENTITY
        ) {
          throw new ForbiddenException(error.messageText);
        }

        throw new ConflictException(error.messageText);
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';
        const conflict = target.includes('campaignKey') && target.includes('verifiedIdentityId')
          ? new VoucherClaimRuleError(
              VoucherClaimAttemptResult.REJECTED_DUPLICATE_CAMPAIGN,
              'Giấy tờ định danh này đã nhận voucher trong chiến dịch này rồi.',
            )
          : new VoucherClaimRuleError(
              VoucherClaimAttemptResult.REJECTED_DUPLICATE_IDENTITY,
              'Giấy tờ định danh này đã nhận voucher này rồi.',
            );

        await this.recordClaimAttempt(
          baseUser,
          voucherId,
          conflict.result,
          conflict.messageText,
          context,
        );

        throw new ConflictException(conflict.messageText);
      }

      throw error;
    }
  }

  private async evaluateVoucherEligibility(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    kycStatus: KycStatus,
    verifiedIdentityId: string | null,
    voucher: Voucher & { approvalStatus?: string },
  ) {
    const now = new Date();

    if (voucher.approvalStatus && voucher.approvalStatus !== 'APPROVED') {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_INACTIVE,
        'Voucher này chưa được phê duyệt hoặc đã bị hủy.',
      );
    }

    if (voucher.startsAt && voucher.startsAt > now) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_INACTIVE,
        'Voucher chưa bắt đầu.',
      );
    }

    if (voucher.endsAt && voucher.endsAt < now) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_INACTIVE,
        'Voucher đã hết hạn.',
      );
    }

    if (voucher.remainingQuantity != null && voucher.remainingQuantity <= 0) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_OUT_OF_STOCK,
        'Voucher đã hết lượt nhận.',
      );
    }

    if (voucher.requiresKyc && kycStatus !== KycStatus.VERIFIED) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_NOT_VERIFIED,
        'Bạn cần hoàn tất eKYC trước khi nhận voucher.',
      );
    }

    const existingByAccount = await db.voucherClaim.findFirst({
      where: {
        voucherId: voucher.id,
        userId,
      },
      select: { id: true },
    });

    if (existingByAccount) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_DUPLICATE_ACCOUNT,
        'Tài khoản này đã nhận voucher này rồi.',
      );
    }

    if (voucher.claimScope === VoucherClaimScope.PER_ACCOUNT) {
      return { canClaim: true, result: VoucherClaimAttemptResult.SUCCESS, reason: null };
    }

    if (!verifiedIdentityId) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_NO_VERIFIED_IDENTITY,
        'Không tìm thấy định danh đã xác thực cho tài khoản này.',
      );
    }

    const existingByIdentity = await db.voucherClaim.findFirst({
      where: {
        voucherId: voucher.id,
        verifiedIdentityId,
      },
      select: { id: true },
    });

    if (existingByIdentity) {
      return this.rejected(
        VoucherClaimAttemptResult.REJECTED_DUPLICATE_IDENTITY,
        'Giấy tờ định danh này đã nhận voucher này rồi.',
      );
    }

    if (voucher.claimScope === VoucherClaimScope.PER_CAMPAIGN_IDENTITY) {
      if (!voucher.campaignKey) {
        return this.rejected(
          VoucherClaimAttemptResult.REJECTED_RULES,
          'Voucher chưa được cấu hình campaignKey để chống spam theo chiến dịch.',
        );
      }

      const existingCampaignClaim = await db.voucherCampaignIdentityLock.findFirst({
        where: {
          campaignKey: voucher.campaignKey,
          verifiedIdentityId,
        },
        select: { id: true },
      });

      if (existingCampaignClaim) {
        return this.rejected(
          VoucherClaimAttemptResult.REJECTED_DUPLICATE_CAMPAIGN,
          'Giấy tờ định danh này đã nhận voucher trong chiến dịch này rồi.',
        );
      }
    }

    return { canClaim: true, result: VoucherClaimAttemptResult.SUCCESS, reason: null };
  }

  private rejected(result: VoucherClaimAttemptResult, reason: string) {
    return {
      canClaim: false,
      result,
      reason,
    };
  }

  private async recordClaimAttempt(
    user: { id: string; verifiedIdentityId: string | null },
    voucherId: string,
    result: VoucherClaimAttemptResult,
    reason: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    await this.prisma.voucherClaimAttempt.create({
      data: {
        voucherId,
        userId: user.id,
        verifiedIdentityId: user.verifiedIdentityId,
        result,
        reason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  }
}
