import { Module } from '@nestjs/common';
import { InternalEkycController } from './internal-ekyc.controller';
import { InternalEkycService } from './internal-ekyc.service';
import { EkycDecisionService } from './services/ekyc-decision.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InternalEkycController],
  providers: [InternalEkycService, EkycDecisionService],
  exports: [InternalEkycService, EkycDecisionService],
})
export class InternalEkycModule {}
