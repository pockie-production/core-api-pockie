import { Module } from '@nestjs/common';
import { InternalAuthController } from './internal-auth.controller';
import { InternalAuthService } from './internal-auth.service';

@Module({
  controllers: [InternalAuthController],
  providers: [InternalAuthService],
})
export class InternalAuthModule {}
