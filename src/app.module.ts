import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { InternalDashboardModule } from './modules/internal-dashboard/internal-dashboard.module';
import { VnptEkycModule } from './integrations/vnpt-ekyc/vnpt-ekyc.module';
import { InternalEkycModule } from './modules/internal-ekyc/internal-ekyc.module';
import { EnduserEkycModule } from './modules/enduser-ekyc/enduser-ekyc.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    AuthModule,
    InternalAuthModule,
    InternalDashboardModule,
    VnptEkycModule,
    InternalEkycModule,
    EnduserEkycModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
