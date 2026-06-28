import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EkycDecisionService } from '../internal-ekyc/services/ekyc-decision.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VnptEkycService } from '../../integrations/vnpt-ekyc/vnpt-ekyc.service';
import { MinioService } from '../../integrations/minio/minio.service';
import { EkycSessionStatus, EkycDocumentSide, EkycDocumentType } from '@prisma/client';

@Injectable()
export class EnduserEkycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnptEkycService: VnptEkycService,
    private readonly minioService: MinioService,
    private readonly ekycDecisionService: EkycDecisionService,
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

  async uploadDocument(sessionId: string, userId: string, data: { documentType: string, side: string }, file: Express.Multer.File) {
    const session = await this.prisma.ekycSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException('Session not found');
    if (session.status !== EkycSessionStatus.DRAFT) throw new BadRequestException('Session is not in DRAFT status');

    // Upload to MinIO
    const fileId = await this.minioService.uploadFile(file, `ekyc/${userId}/${sessionId}`);

    // Check if side already exists, if so update it, else create
    let doc = await this.prisma.ekycDocument.findFirst({
      where: { sessionId, side: data.side as EkycDocumentSide }
    });

    if (doc) {
      doc = await this.prisma.ekycDocument.update({
        where: { id: doc.id },
        data: { fileId, documentType: data.documentType as EkycDocumentType }
      });
    } else {
      doc = await this.prisma.ekycDocument.create({
        data: {
          sessionId,
          side: data.side as EkycDocumentSide,
          documentType: data.documentType as EkycDocumentType,
          fileId,
        }
      });
    }
    
    return { documentId: doc.id, fileId: doc.fileId };
  }

  async submitSession(sessionId: string, userId: string) {
    const session = await this.prisma.ekycSession.findUnique({ 
      where: { id: sessionId },
      include: { documents: true }
    });
    
    if (!session || session.userId !== userId) throw new NotFoundException('Session not found');
    if (session.status !== EkycSessionStatus.DRAFT) throw new BadRequestException('Session already submitted');

    const frontDoc = session.documents.find(d => d.side === EkycDocumentSide.FRONT);
    const backDoc = session.documents.find(d => d.side === EkycDocumentSide.BACK);
    const selfieDoc = session.documents.find(d => d.side === EkycDocumentSide.SELFIE);

    if (!frontDoc || !backDoc || !selfieDoc) {
      throw new BadRequestException('Missing required documents (FRONT, BACK, SELFIE)');
    }

    await this.prisma.ekycSession.update({
      where: { id: sessionId },
      data: { status: EkycSessionStatus.PROCESSING }
    });

    try {
      if (!frontDoc.fileId || !backDoc.fileId || !selfieDoc.fileId) {
        throw new BadRequestException('Files missing for one or more required documents');
      }

      // 1. Fetch buffers from Minio
      const frontBuffer = await this.minioService.getFileBuffer(frontDoc.fileId);
      const backBuffer = await this.minioService.getFileBuffer(backDoc.fileId);
      const selfieBuffer = await this.minioService.getFileBuffer(selfieDoc.fileId);

      // 2. Upload to VNPT to get hashes
      const frontVnpt = await this.vnptEkycService.uploadFile(frontBuffer, 'front.jpg', 'Front ID', '', sessionId);
      const backVnpt = await this.vnptEkycService.uploadFile(backBuffer, 'back.jpg', 'Back ID', '', sessionId);
      const selfieVnpt = await this.vnptEkycService.uploadFile(selfieBuffer, 'selfie.jpg', 'Selfie', '', sessionId);

      const frontHash = frontVnpt.object.hash;
      const backHash = backVnpt.object.hash;
      const selfieHash = selfieVnpt.object.hash;

      // 3. Call VNPT APIs
      const [ocrResult, cardLivenessResult, faceLivenessResult, faceCompareResult] = await Promise.all([
        this.vnptEkycService.ocrId(frontHash, backHash, sessionId),
        this.vnptEkycService.cardLiveness(frontHash, sessionId),
        this.vnptEkycService.faceLiveness2D(selfieHash, sessionId),
        this.vnptEkycService.faceCompare(frontHash, selfieHash, sessionId),
      ]);

      // 4. Save results to DB
      await this.prisma.$transaction([
        this.prisma.ekycOcrResult.create({
          data: {
            sessionId,
            statusCode: ocrResult.statusCode || 200,
            message: ocrResult.message || '',
            rawResponse: ocrResult.raw_response_json as any,
          }
        }),
        this.prisma.ekycLivenessCardResult.create({
          data: {
            sessionId,
            liveness: cardLivenessResult.liveness || 'unknown',
            livenessMsg: cardLivenessResult.liveness_msg || '',
            faceSwapping: cardLivenessResult.face_swapping || false,
            fakeLiveness: cardLivenessResult.fake_liveness || false,
            fakePrintPhoto: cardLivenessResult.fake_print_photo || false,
            rawResponse: cardLivenessResult.raw_response_json as any,
          }
        }),
        this.prisma.ekycFaceLivenessResult.create({
          data: {
            sessionId,
            liveness: faceLivenessResult.liveness || 'unknown',
            livenessMsg: faceLivenessResult.liveness_msg || '',
            livenessProb: faceLivenessResult.liveness_prob || 0,
            blurFace: faceLivenessResult.blur_face || '',
            isEyeOpen: faceLivenessResult.is_eye_open || '',
            rawResponse: faceLivenessResult.raw_response_json as any,
          }
        }),
        this.prisma.ekycFaceCompareResult.create({
          data: {
            sessionId,
            msg: faceCompareResult.msg || 'UNKNOWN',
            prob: faceCompareResult.prob || 0,
            rawResponse: faceCompareResult.raw_response_json as any,
          }
        })
      ]);

      // Note: Ocr fields and warnings extraction would happen here or in DecisionEngine
      
      // 5. Evaluate Decision
      const decision = await this.ekycDecisionService.evaluateSession(sessionId);

      // 6. Update user KYC status
      await this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: decision.status as any }
      });

      return { success: true, status: decision.status, decision: decision.finalDecision };
    } catch (error) {
      await this.prisma.ekycSession.update({
        where: { id: sessionId },
        data: { status: EkycSessionStatus.FAILED, finalDecision: 'FAIL' }
      });
      throw error;
    }
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
