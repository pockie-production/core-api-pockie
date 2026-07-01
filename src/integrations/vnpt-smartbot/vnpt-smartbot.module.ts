import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VnptSmartbotService } from './vnpt-smartbot.service';

@Module({
  imports: [HttpModule],
  providers: [VnptSmartbotService],
  exports: [VnptSmartbotService],
})
export class VnptSmartbotModule {}
