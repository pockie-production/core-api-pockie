import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { InternalDashboardModule } from './modules/internal-dashboard/internal-dashboard.module';

@Module({
  imports: [ConfigModule.forRoot(), PrismaModule, AuthModule, InternalAuthModule, InternalDashboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
