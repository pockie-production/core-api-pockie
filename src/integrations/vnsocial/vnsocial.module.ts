import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { VnSocialService } from './vnsocial.service';

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [VnSocialService],
  exports: [VnSocialService],
})
export class VnSocialModule {}
