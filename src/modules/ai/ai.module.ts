import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { VnptSmartbotModule } from '../../integrations/vnpt-smartbot/vnpt-smartbot.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { GamificationModule } from '../gamification/gamification.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FinanceModule, GamificationModule, UsersModule, PrismaModule, VnptSmartbotModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
