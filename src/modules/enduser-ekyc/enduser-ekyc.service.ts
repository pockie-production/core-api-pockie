import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VnptEkycService } from '../../integrations/vnpt-ekyc/vnpt-ekyc.service';
import { EkycSessionStatus, EkycDocumentSide, EkycDocumentType } from '@prisma/client';

@Injectable()
export class EnduserEkycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnptEkycService: VnptEkycService,
  ) {}

  async createSession(userId: string) {
    // Basic skeleton for session creation
    const session = await this.prisma.ekycSession.create({
      data: {
        userId,
        status: EkycSessionStatus.DRAFT,
        clientSession: `session_${Date.now()}`
      }
    });
    return { sessionId: session.id };
  }

  async uploadDocument(sessionId: string, userId: string, data: { documentType: string, side: string, fileId: string }) {
    // Basic skeleton for uploading/saving document details
    const session = await this.prisma.ekycSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException('Session not found');

    const doc = await this.prisma.ekycDocument.create({
      data: {
        sessionId,
        side: data.side as EkycDocumentSide,
        documentType: data.documentType as EkycDocumentType,
        fileId: data.fileId,
      }
    });
    
    return { documentId: doc.id };
  }

  async submitSession(sessionId: string, userId: string) {
    // Basic skeleton for submitting session (would trigger VNPT calls here)
    const session = await this.prisma.ekycSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException('Session not found');

    await this.prisma.ekycSession.update({
      where: { id: sessionId },
      data: { status: EkycSessionStatus.PROCESSING }
    });

    // Dummy submission logic, ideally calls VNPT and saves result then updates to REVIEW_REQUIRED or VERIFIED
    return { success: true, status: 'PROCESSING' };
  }

  async getStatus(sessionId: string, userId: string) {
    const session = await this.prisma.ekycSession.findUnique({ 
      where: { id: sessionId },
      select: { id: true, status: true, finalDecision: true } 
    });
    if (!session) throw new NotFoundException('Session not found');

    return session;
  }
}
