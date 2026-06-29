import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
