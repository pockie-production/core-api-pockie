import { Module } from '@nestjs/common';
import { EnduserEkycController } from './enduser-ekyc.controller';
import { EnduserEkycService } from './enduser-ekyc.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { VnptEkycModule } from '../../integrations/vnpt-ekyc/vnpt-ekyc.module';

@Module({
  imports: [PrismaModule, VnptEkycModule],
  controllers: [EnduserEkycController],
  providers: [EnduserEkycService],
})
export class EnduserEkycModule {}
