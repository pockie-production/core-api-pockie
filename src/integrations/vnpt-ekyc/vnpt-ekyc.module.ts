import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VnptEkycService } from './vnpt-ekyc.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Adjust based on your setup

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [VnptEkycService],
  exports: [VnptEkycService],
})
export class VnptEkycModule {}
