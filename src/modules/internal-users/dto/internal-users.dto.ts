import { ApiPropertyOptional } from '@nestjs/swagger';
import { KycStatus, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum InternalUserAccountType {
  END_USER = 'end_user',
  INTERNAL = 'internal',
  BANK = 'bank',
}

export class InternalUsersQueryDto {
  @ApiPropertyOptional({ example: 'nguyen', description: 'Search by email, phone, full name or display name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: InternalUserAccountType })
  @IsOptional()
  @IsEnum(InternalUserAccountType)
  accountType?: InternalUserAccountType;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: KycStatus })
  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @ApiPropertyOptional({ example: 'SUPER_ADMIN' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'organization-uuid' })
  @IsOptional()
  @IsString()
  organizationId?: string;

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

  @ApiPropertyOptional({ example: 'createdAt', enum: ['createdAt', 'email', 'status'] })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'email' | 'status';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class UpdateInternalUserStatusDto {
  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.SUSPENDED })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({ example: 'Suspicious activity review' })
  @IsOptional()
  @IsString()
  reason?: string;
}
