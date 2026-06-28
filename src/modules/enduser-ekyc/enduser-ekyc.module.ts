import { Module } from '@nestjs/common';
import { EnduserEkycController } from './enduser-ekyc.controller';
import { EnduserEkycService } from './enduser-ekyc.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { VnptEkycModule } from '../../integrations/vnpt-ekyc/vnpt-ekyc.module';
import { InternalEkycModule } from '../internal-ekyc/internal-ekyc.module';

@Module({
  imports: [PrismaModule, VnptEkycModule, InternalEkycModule],
  controllers: [EnduserEkycController],
  providers: [EnduserEkycService],
})
export class EnduserEkycModule {}
