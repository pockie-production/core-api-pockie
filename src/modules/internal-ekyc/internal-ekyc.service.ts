import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EkycSessionStatus, EkycFinalDecision, KycStatus, RoleCode } from '@prisma/client';

@Injectable()
export class InternalEkycService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessions(query: any) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      finalDecision,
      riskLevel,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (finalDecision) where.finalDecision = finalDecision;
    if (riskLevel) where.riskLevel = riskLevel;
    
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { profile: { fullName: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.ekycSession.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: { select: { fullName: true } },
            },
          },
          ocrResult: { select: { warnings: true, tampering: true } },
          faceCompare: { select: { msg: true, prob: true } },
          livenessCard: { select: { liveness: true } },
          faceLiveness: { select: { liveness: true } },
        },
      }),
      this.prisma.ekycSession.count({ where }),
    ]);

    const mappedItems = items.map(item => ({
      id: item.id,
      user: {
        id: item.user.id,
        email: item.user.email,
        phone: item.user.phone,
        fullName: item.user.profile?.fullName,
      },
      status: item.status,
      finalDecision: item.finalDecision,
      riskLevel: item.riskLevel,
      warningCount: item.ocrResult?.warnings.length || 0,
      tamperingCount: item.ocrResult?.tampering.length || 0,
      compare: item.faceCompare ? { msg: item.faceCompare.msg, prob: item.faceCompare.prob } : null,
      liveness: {
        card: item.livenessCard?.liveness,
        face: item.faceLiveness?.liveness,
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      items: mappedItems,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getSessionDetail(id: string, userRoles: RoleCode[]) {
    const session = await this.prisma.ekycSession.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            profile: { select: { fullName: true } },
          },
        },
        documents: {
          include: { vnptUpload: true },
        },
        ocrResult: {
          include: { fields: true, warnings: true, tampering: true },
        },
        livenessCard: true,
        faceLiveness: true,
        faceCompare: true,
        maskResult: true,
        decisionLogs: { orderBy: { createdAt: 'desc' } },
        internalNotes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { email: true } } },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const isSupport = userRoles.includes(RoleCode.SUPPORT_STAFF) && !userRoles.includes(RoleCode.SUPER_ADMIN) && !userRoles.includes(RoleCode.INTERNAL_ADMIN);

    // Filter/mask sensitive data for support staff
    let ocrFields = session.ocrResult?.fields || [];
    if (isSupport) {
      ocrFields = ocrFields.map(f => {
        if (f.fieldName === 'id' && f.fieldValue.length > 4) {
          return { ...f, fieldValue: '********' + f.fieldValue.slice(-4) };
        }
        if (f.fieldName === 'recent_location' || f.fieldName === 'origin_location') {
          return { ...f, fieldValue: '*** Masked ***' };
        }
        return f;
      });
    }

    return {
      session: {
        id: session.id,
        status: session.status,
        finalDecision: session.finalDecision,
        riskLevel: session.riskLevel,
        decisionReason: session.decisionReason,
        clientSession: session.clientSession,
        createdAt: session.createdAt,
      },
      user: session.user,
      documents: session.documents.map(d => ({
        id: d.id,
        side: d.side,
        documentType: d.documentType,
        fileId: d.fileId,
        vnptHashStatus: d.vnptUpload ? (d.vnptUpload.hashExpiresAt > new Date() ? 'VALID' : 'EXPIRED') : 'NONE',
      })),
      ocr: session.ocrResult ? {
        statusCode: session.ocrResult.statusCode,
        message: session.ocrResult.message,
        fields: ocrFields,
      } : null,
      warnings: session.ocrResult?.warnings || [],
      tamperingFindings: session.ocrResult?.tampering || [],
      livenessCard: session.livenessCard,
      faceLiveness: session.faceLiveness,
      faceCompare: session.faceCompare,
      mask: session.maskResult,
      decisionLogs: session.decisionLogs,
      internalNotes: session.internalNotes.map(n => ({
        id: n.id,
        note: n.note,
        author: n.author.email,
        createdAt: n.createdAt,
      })),
    };
  }

  async approveSession(id: string, actorId: string, note?: string) {
    const session = await this.prisma.ekycSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.$transaction([
      this.prisma.ekycSession.update({
        where: { id },
        data: {
          status: EkycSessionStatus.VERIFIED,
          finalDecision: EkycFinalDecision.PASS,
        },
      }),
      this.prisma.user.update({
        where: { id: session.userId },
        data: { kycStatus: KycStatus.VERIFIED },
      }),
      this.prisma.ekycDecisionLog.create({
        data: {
          sessionId: id,
          decision: EkycFinalDecision.PASS,
          reason: 'Manual approval',
        },
      }),
      ...(note
        ? [
            this.prisma.ekycInternalNote.create({
              data: {
                sessionId: id,
                authorId: actorId,
                note,
              },
            }),
          ]
        : []),
      this.prisma.adminActionLog.create({
        data: {
          actorUserId: actorId,
          action: 'EKYC_MANUAL_APPROVE',
          targetType: 'EKYC_SESSION',
          targetId: id,
          payload: {
            note,
            previousStatus: session.status,
            newStatus: EkycSessionStatus.VERIFIED,
          },
        },
      }),
    ]);

    return { message: 'Session approved successfully' };
  }

  async rejectSession(id: string, actorId: string, reason: string, note?: string) {
    const session = await this.prisma.ekycSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.$transaction([
      this.prisma.ekycSession.update({
        where: { id },
        data: {
          status: EkycSessionStatus.REJECTED,
          finalDecision: EkycFinalDecision.FAIL,
        },
      }),
      this.prisma.user.update({
        where: { id: session.userId },
        data: { kycStatus: KycStatus.REJECTED },
      }),
      this.prisma.ekycDecisionLog.create({
        data: {
          sessionId: id,
          decision: EkycFinalDecision.FAIL,
          reason: `Manual rejection: ${reason}`,
        },
      }),
      ...(note
        ? [
            this.prisma.ekycInternalNote.create({
              data: {
                sessionId: id,
                authorId: actorId,
                note,
              },
            }),
          ]
        : []),
      this.prisma.adminActionLog.create({
        data: {
          actorUserId: actorId,
          action: 'EKYC_REJECT',
          targetType: 'EKYC_SESSION',
          targetId: id,
          payload: {
            reason,
            note,
            previousStatus: session.status,
            newStatus: EkycSessionStatus.REJECTED,
          },
        },
      }),
    ]);

    return { message: 'Session rejected successfully' };
  }

  async requestRetry(id: string, actorId: string, reason: string, note?: string) {
    const session = await this.prisma.ekycSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.$transaction([
      this.prisma.ekycSession.update({
        where: { id },
        data: {
          status: EkycSessionStatus.RETRY_REQUIRED,
          finalDecision: EkycFinalDecision.RETRY,
        },
      }),
      this.prisma.user.update({
        where: { id: session.userId },
        data: { kycStatus: KycStatus.PENDING },
      }),
      this.prisma.ekycDecisionLog.create({
        data: {
          sessionId: id,
          decision: EkycFinalDecision.RETRY,
          reason: `Manual retry request: ${reason}`,
        },
      }),
      this.prisma.adminActionLog.create({
        data: {
          actorUserId: actorId,
          action: 'EKYC_REQUEST_RETRY',
          targetType: 'EKYC_SESSION',
          targetId: id,
          payload: { previousStatus: session.status, newStatus: EkycSessionStatus.RETRY_REQUIRED, reason, note },
        },
      }),
      ...(note
        ? [
            this.prisma.ekycInternalNote.create({
              data: { sessionId: id, authorId: actorId, note },
            }),
          ]
        : []),
    ]);

    return { success: true };
  }

  async addNote(id: string, actorId: string, note: string) {
    const session = await this.prisma.ekycSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.$transaction([
      this.prisma.ekycInternalNote.create({
        data: {
          sessionId: id,
          authorId: actorId,
          note,
        },
      }),
      this.prisma.adminActionLog.create({
        data: {
          actorUserId: actorId,
          action: 'EKYC_ADD_NOTE',
          targetType: 'EKYC_SESSION',
          targetId: id,
          payload: { note },
        },
      }),
    ]);

    return { success: true };
  }

  async getProviderLogs(id: string, userRoles: RoleCode[]) {
    const isSupport = userRoles.includes(RoleCode.SUPPORT_STAFF) && !userRoles.includes(RoleCode.SUPER_ADMIN) && !userRoles.includes(RoleCode.INTERNAL_ADMIN);
    if (isSupport) {
      throw new ForbiddenException('Support staff cannot view raw provider logs');
    }

    const logs = await this.prisma.ekycProviderRequest.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }
}
