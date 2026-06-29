import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EkycDecisionService } from '../internal-ekyc/services/ekyc-decision.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VnptEkycService } from '../../integrations/vnpt-ekyc/vnpt-ekyc.service';
import { MinioService } from '../../integrations/minio/minio.service';
import { EkycSessionStatus, EkycDocumentSide, EkycDocumentType, KycStatus } from '@prisma/client';
import { VerifiedIdentityService } from '../verified-identity/verified-identity.service';

@Injectable()
export class EnduserEkycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnptEkycService: VnptEkycService,
    private readonly minioService: MinioService,
    private readonly ekycDecisionService: EkycDecisionService,
    private readonly verifiedIdentityService: VerifiedIdentityService,
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
    const objectKey = await this.minioService.uploadFile(file, `ekyc/${userId}/${sessionId}`);

    const fileRecord = await this.prisma.file.create({
      data: {
        ownerId: userId,
        bucket: 'ekyc-documents',
        objectKey: objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        purpose: 'EKYC'
      }
    });

    // Check if side already exists, if so update it, else create
    let doc = await this.prisma.ekycDocument.findFirst({
      where: { sessionId, side: data.side as EkycDocumentSide }
    });

    if (doc) {
      doc = await this.prisma.ekycDocument.update({
        where: { id: doc.id },
        data: { fileId: fileRecord.id, documentType: data.documentType as EkycDocumentType }
      });
    } else {
      doc = await this.prisma.ekycDocument.create({
        data: {
          sessionId,
          side: data.side as EkycDocumentSide,
          documentType: data.documentType as EkycDocumentType,
          fileId: fileRecord.id,
        }
      });
    }
    
    return { documentId: doc.id, fileId: doc.fileId };
  }

  async submitSession(sessionId: string, userId: string) {
    const session = await this.prisma.ekycSession.findUnique({ 
      where: { id: sessionId },
      include: { documents: { include: { file: true } } }
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
      if (!frontDoc.file?.objectKey || !backDoc.file?.objectKey || !selfieDoc.file?.objectKey) {
        throw new BadRequestException('Files missing for one or more required documents');
      }

      // 1. Fetch buffers from Minio
      const frontBuffer = await this.minioService.getFileBuffer(frontDoc.file.objectKey);
      const backBuffer = await this.minioService.getFileBuffer(backDoc.file.objectKey);
      const selfieBuffer = await this.minioService.getFileBuffer(selfieDoc.file.objectKey);

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
      const ocrFields = this.extractOcrFields(ocrResult.object);
      await this.prisma.$transaction([
        this.prisma.ekycOcrResult.create({
          data: {
            sessionId,
            statusCode: ocrResult.statusCode || 200,
            message: ocrResult.message || '',
            rawResponse: ocrResult.raw_response_json as any,
            fields: ocrFields.length
              ? {
                  createMany: {
                    data: ocrFields,
                  },
                }
              : undefined,
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

      // 6. Persist decision and attach verified identity atomically
      await this.prisma.$transaction(async (tx) => {
        await tx.ekycSession.update({
          where: { id: sessionId },
          data: {
            status: decision.status,
            finalDecision: decision.finalDecision,
            riskLevel: decision.riskLevel,
            decisionReason: decision.reasons.join('; '),
          },
        });

        await tx.ekycDecisionLog.create({
          data: {
            sessionId,
            decision: decision.finalDecision,
            reason: decision.reasons.join('; '),
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            kycStatus:
              decision.status === EkycSessionStatus.VERIFIED
                ? KycStatus.VERIFIED
                : decision.status === EkycSessionStatus.REJECTED
                  ? KycStatus.REJECTED
                  : KycStatus.PENDING,
          },
        });

        if (decision.status === EkycSessionStatus.VERIFIED) {
          await this.verifiedIdentityService.attachVerifiedIdentityToUserFromSession(
            sessionId,
            userId,
            tx,
          );
        }
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

  private extractOcrFields(
    object?: Record<string, unknown>,
  ) {
    if (!object) {
      return [];
    }

    const candidates: Array<{ fieldName: string; fieldValue: string | undefined; probability?: number | undefined }> = [
      { fieldName: 'id', fieldValue: this.readString(object.id), probability: this.readNumber(object.id_prob) },
      { fieldName: 'name', fieldValue: this.readString(object.name), probability: this.readNumber(object.name_prob) },
      { fieldName: 'birth_day', fieldValue: this.readString(object.birth_day), probability: this.readNumber(object.birth_day_prob) },
      { fieldName: 'gender', fieldValue: this.readString(object.gender) },
      { fieldName: 'nationality', fieldValue: this.readString(object.nationality) },
      { fieldName: 'origin_location', fieldValue: this.readString(object.origin_location), probability: this.readNumber(object.origin_location_prob) },
      { fieldName: 'recent_location', fieldValue: this.readString(object.recent_location), probability: this.readNumber(object.recent_location_prob) },
      { fieldName: 'issue_date', fieldValue: this.readString(object.issue_date), probability: this.readNumber(object.issue_date_prob) },
      { fieldName: 'valid_date', fieldValue: this.readString(object.valid_date) },
      { fieldName: 'issue_place', fieldValue: this.readString(object.issue_place), probability: this.readNumber(object.issue_place_prob) },
    ];

    return candidates
      .filter((candidate) => candidate.fieldValue)
      .map((candidate) => ({
        fieldName: candidate.fieldName,
        fieldValue: candidate.fieldValue as string,
        probability: candidate.probability,
      }));
  }

  private readString(value: unknown) {
    return typeof value === 'string' ? value : undefined;
  }

  private readNumber(value: unknown) {
    return typeof value === 'number' ? value : undefined;
  }
}
