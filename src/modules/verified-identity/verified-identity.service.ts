import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  EkycDocumentType,
  Prisma,
  VerifiedIdentity,
  VerifiedIdentityStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SessionWithIdentityData = Prisma.EkycSessionGetPayload<{
  include: {
    documents: true;
    ocrResult: {
      include: {
        fields: true;
      };
    };
  };
}>;

@Injectable()
export class VerifiedIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async attachVerifiedIdentityToUserFromSession(
    sessionId: string,
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const session = await db.ekycSession.findUnique({
      where: { id: sessionId },
      include: {
        documents: true,
        ocrResult: {
          include: {
            fields: true,
          },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Không tìm thấy dữ liệu định danh để liên kết người dùng.');
    }

    const payload = this.extractIdentityPayload(session);
    const verifiedIdentity = await db.verifiedIdentity.upsert({
      where: {
        documentType_documentNumberHash: {
          documentType: payload.documentType,
          documentNumberHash: payload.documentNumberHash,
        },
      },
      create: {
        documentType: payload.documentType,
        documentNumberHash: payload.documentNumberHash,
        documentNumberMasked: payload.documentNumberMasked,
        fullNameNormalized: payload.fullNameNormalized,
        dateOfBirth: payload.dateOfBirth,
        provider: 'VNPT',
        sourceSessionId: session.id,
        riskLevel: session.riskLevel,
        status: VerifiedIdentityStatus.VERIFIED,
        metadata: {
          sessionId: session.id,
          finalDecision: session.finalDecision,
        },
      },
      update: {
        documentNumberMasked: payload.documentNumberMasked,
        fullNameNormalized: payload.fullNameNormalized,
        dateOfBirth: payload.dateOfBirth,
        sourceSessionId: session.id,
        riskLevel: session.riskLevel,
        status: VerifiedIdentityStatus.VERIFIED,
        metadata: {
          sessionId: session.id,
          finalDecision: session.finalDecision,
        },
      },
    });

    await db.user.update({
      where: { id: userId },
      data: {
        verifiedIdentityId: verifiedIdentity.id,
      },
    });

    return verifiedIdentity;
  }

  private extractIdentityPayload(session: SessionWithIdentityData) {
    const frontDocument = session.documents.find((document) => document.side === 'FRONT');
    const rawObject = this.extractRawOcrObject(session.ocrResult?.rawResponse);
    const fieldMap = new Map(
      (session.ocrResult?.fields ?? []).map((field) => [
        field.fieldName.toLowerCase(),
        field.fieldValue,
      ]),
    );

    const documentNumber = this.normalizeDocumentNumber(
      fieldMap.get('id') ??
        this.readString(rawObject?.id),
    );
    const fullNameNormalized = this.normalizeFullName(
      fieldMap.get('name') ??
        this.readString(rawObject?.name),
    );
    const dateOfBirth = this.normalizeOptionalString(
      fieldMap.get('birth_day') ??
        this.readString(rawObject?.birth_day),
    );
    const documentType = frontDocument?.documentType ?? EkycDocumentType.UNKNOWN;

    if (!documentNumber || documentType === EkycDocumentType.UNKNOWN) {
      throw new BadRequestException('Không thể xác định giấy tờ định danh đã xác thực.');
    }

    return {
      documentType,
      documentNumberHash: this.hashDocumentNumber(documentNumber),
      documentNumberMasked: this.maskDocumentNumber(documentNumber),
      fullNameNormalized,
      dateOfBirth,
    };
  }

  private extractRawOcrObject(rawResponse: Prisma.JsonValue | null | undefined) {
    if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
      return null;
    }

    const value = rawResponse as Record<string, unknown>;
    const objectValue = value.object;
    if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) {
      return null;
    }

    return objectValue as Record<string, unknown>;
  }

  private readString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private normalizeDocumentNumber(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/\s+/g, '').trim();
    return normalized.length ? normalized : null;
  }

  private normalizeFullName(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();

    return normalized.length ? normalized : null;
  }

  private normalizeOptionalString(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private hashDocumentNumber(documentNumber: string) {
    return createHash('sha256').update(documentNumber).digest('hex');
  }

  private maskDocumentNumber(documentNumber: string) {
    if (documentNumber.length <= 6) {
      return `${documentNumber.slice(0, 1)}***${documentNumber.slice(-1)}`;
    }

    return `${documentNumber.slice(0, 3)}****${documentNumber.slice(-3)}`;
  }
}
