import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrendStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TrendsQueryDto {
  @ApiPropertyOptional({ example: 'cashback' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: TrendStatus })
  @IsOptional()
  @IsEnum(TrendStatus)
  status?: TrendStatus;

  @ApiPropertyOptional({ example: 'positive' })
  @IsOptional()
  @IsString()
  sentiment?: string;

  @ApiPropertyOptional({ example: 'tiktok' })
  @IsOptional()
  @IsString()
  sourceChannel?: string;

  @ApiPropertyOptional({ example: 'project-uuid' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class TrendDecisionDto {
  @ApiPropertyOptional({ example: 'Strong signal for cashback campaign' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Low relevance for current campaign' })
  @IsOptional()
  @IsString()
  reason?: string;
}
