import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EkycSessionStatus, EkycFinalDecision, EkycRiskLevel } from '@prisma/client';

export type EkycDecisionResult = {
  finalDecision: EkycFinalDecision;
  status: EkycSessionStatus;
  riskLevel: EkycRiskLevel;
  reasons: string[];
};

@Injectable()
export class EkycDecisionService {
  private readonly logger = new Logger(EkycDecisionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateSession(sessionId: string): Promise<EkycDecisionResult> {
    const session = await this.prisma.ekycSession.findUnique({
      where: { id: sessionId },
      include: {
        ocrResult: { include: { warnings: true, tampering: true } },
        livenessCard: true,
        faceLiveness: true,
        faceCompare: true,
        maskResult: true,
      },
    });

    if (!session) {
      throw new Error(`EkycSession ${sessionId} not found`);
    }

    const reasons: string[] = [];
    let isFail = false;
    let isReview = false;
    let isRetry = false;

    // 1. Evaluate OCR
    if (session.ocrResult) {
      if (session.ocrResult.statusCode !== 200) {
        isFail = true;
        reasons.push(`OCR failed with status ${session.ocrResult.statusCode}`);
      }

      for (const t of session.ocrResult.tampering) {
        if (['id_sua_xoa', 'id_ko_hop_le', 'mrz_khong_hop_le'].includes(t.code)) {
          isFail = true;
          reasons.push(`Severe tampering detected: ${t.code}`);
        } else {
          isReview = true;
          reasons.push(`Tampering warning: ${t.code}`);
        }
      }

      for (const w of session.ocrResult.warnings) {
        if (['anh_dau_vao_mo_nhoe', 'anh_dau_vao_mat_goc', 'anh_mat_truoc_bi_che'].includes(w.code)) {
          isRetry = true;
          reasons.push(`Image quality requires retry: ${w.code}`);
        } else {
          isReview = true;
          reasons.push(`OCR Warning: ${w.code}`);
        }
      }
    } else {
      isFail = true;
      reasons.push('Missing OCR result');
    }

    // 2. Evaluate Card Liveness
    if (session.livenessCard) {
      if (session.livenessCard.liveness === 'failure') {
        isFail = true;
        reasons.push('Card Liveness failed');
      }
      if (session.livenessCard.faceSwapping || session.livenessCard.fakeLiveness || session.livenessCard.fakePrintPhoto) {
        isFail = true;
        reasons.push('Card Liveness detected fake document');
      }
    } else {
      isFail = true;
      reasons.push('Missing Card Liveness result');
    }

    // 3. Evaluate Face Liveness
    if (session.faceLiveness) {
      if (session.faceLiveness.liveness === 'failure') {
        isFail = true;
        reasons.push('Face Liveness failed');
      }
      if (session.faceLiveness.blurFace === 'yes') {
        isRetry = true;
        reasons.push('Selfie is blurred');
      }
      if (session.faceLiveness.multipleFaces) {
        isRetry = true;
        reasons.push('Multiple faces detected in selfie');
      }
    } else {
      isFail = true;
      reasons.push('Missing Face Liveness result');
    }

    // 4. Evaluate Face Compare
    if (session.faceCompare) {
      if (session.faceCompare.msg === 'NOMATCH') {
        isFail = true;
        reasons.push('Face Compare failed: Selfie does not match document');
      } else if (session.faceCompare.matchWarning === 'yes') {
        isReview = true;
        reasons.push('Face Compare match warning');
      }
    } else {
      isFail = true;
      reasons.push('Missing Face Compare result');
    }

    // 5. Evaluate Mask Face
    if (session.maskResult) {
      if (session.maskResult.masked === 'yes') {
        isRetry = true;
        reasons.push('Face is masked in selfie');
      }
    }

    // Combine decisions
    let finalDecision: EkycFinalDecision = EkycFinalDecision.PASS;
    let status: EkycSessionStatus = EkycSessionStatus.VERIFIED;
    let riskLevel: EkycRiskLevel = EkycRiskLevel.LOW;

    if (isFail) {
      finalDecision = EkycFinalDecision.FAIL;
      status = EkycSessionStatus.REJECTED;
      riskLevel = EkycRiskLevel.CRITICAL;
    } else if (isRetry) {
      finalDecision = EkycFinalDecision.RETRY;
      status = EkycSessionStatus.RETRY_REQUIRED;
      riskLevel = EkycRiskLevel.MEDIUM;
    } else if (isReview) {
      finalDecision = EkycFinalDecision.REVIEW;
      status = EkycSessionStatus.REVIEW_REQUIRED;
      riskLevel = EkycRiskLevel.HIGH;
    }

    if (reasons.length === 0) {
      reasons.push('Auto-verified successfully');
    }

    return { finalDecision, status, riskLevel, reasons };
  }
}
