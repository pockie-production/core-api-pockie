import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FinanceModule } from '../finance/finance.module';
import { GamificationModule } from '../gamification/gamification.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FinanceModule, GamificationModule, UsersModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
