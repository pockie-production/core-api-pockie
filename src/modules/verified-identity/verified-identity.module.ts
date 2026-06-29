import { Module } from '@nestjs/common';
import { VerifiedIdentityService } from './verified-identity.service';

@Module({
  providers: [VerifiedIdentityService],
  exports: [VerifiedIdentityService],
})
export class VerifiedIdentityModule {}
