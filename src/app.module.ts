import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { InternalDashboardModule } from './modules/internal-dashboard/internal-dashboard.module';
import { VnptEkycModule } from './integrations/vnpt-ekyc/vnpt-ekyc.module';
import { MinioModule } from './integrations/minio/minio.module';
import { InternalEkycModule } from './modules/internal-ekyc/internal-ekyc.module';
import { EnduserEkycModule } from './modules/enduser-ekyc/enduser-ekyc.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { FinanceModule } from './modules/finance/finance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InsightsModule } from './modules/insights/insights.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { InternalUsersModule } from './modules/internal-users/internal-users.module';
import { VerifiedIdentityModule } from './modules/verified-identity/verified-identity.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { VnSocialModule } from './integrations/vnsocial/vnsocial.module';
import { VnptSmartbotModule } from './integrations/vnpt-smartbot/vnpt-smartbot.module';
import { TrendsModule } from './modules/trends/trends.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    InternalAuthModule,
    InternalDashboardModule,
    VnptEkycModule,
    MinioModule,
    InternalEkycModule,
    EnduserEkycModule,
    GamificationModule,
    FinanceModule,
    NotificationsModule,
    InsightsModule,
    DashboardModule,
    UsersModule,
    AnalyticsModule,
    InternalUsersModule,
    VerifiedIdentityModule,
    VouchersModule,
    VnSocialModule,
    VnptSmartbotModule,
    TrendsModule,
    CampaignsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
