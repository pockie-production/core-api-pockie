import { Module } from '@nestjs/common';
import { VnSocialModule } from '../../integrations/vnsocial/vnsocial.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { InternalVnsocialController } from './internal-vnsocial.controller';
import { TrendsController } from './trends.controller';
import { TrendsService } from './trends.service';

@Module({
  imports: [PrismaModule, VnSocialModule],
  controllers: [TrendsController, InternalVnsocialController],
  providers: [TrendsService],
  exports: [TrendsService],
})
export class TrendsModule {}
