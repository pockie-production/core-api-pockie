import { Module } from '@nestjs/common';
import { EnduserEkycController } from './enduser-ekyc.controller';
import { EnduserEkycService } from './enduser-ekyc.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { VnptEkycModule } from '../../integrations/vnpt-ekyc/vnpt-ekyc.module';
import { InternalEkycModule } from '../internal-ekyc/internal-ekyc.module';
import { VerifiedIdentityModule } from '../verified-identity/verified-identity.module';

@Module({
  imports: [PrismaModule, VnptEkycModule, InternalEkycModule, VerifiedIdentityModule],
  controllers: [EnduserEkycController],
  providers: [EnduserEkycService],
})
export class EnduserEkycModule {}
