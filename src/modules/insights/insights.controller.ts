import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('insights')
@Controller('insights')
export class InsightsController {}
