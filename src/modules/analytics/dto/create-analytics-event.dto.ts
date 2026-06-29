import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnalyticsEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  eventName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  page?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  feature?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionId?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
