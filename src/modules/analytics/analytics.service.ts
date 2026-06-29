import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(userId: string | null, dto: CreateAnalyticsEventDto) {
    await this.prisma.analyticsEvent.create({
      data: {
        userId,
        sessionId: dto.sessionId,
        eventName: dto.eventName,
        page: dto.page,
        feature: dto.feature,
        payload: dto.payload as any,
      },
    });

    return { success: true };
  }
}
