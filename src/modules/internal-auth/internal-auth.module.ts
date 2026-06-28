import { Module } from '@nestjs/common';
import { InternalAuthController, InternalMeController } from './internal-auth.controller';
import { InternalAuthService } from './internal-auth.service';

@Module({
  controllers: [InternalAuthController, InternalMeController],
  providers: [InternalAuthService],
})
export class InternalAuthModule {}
