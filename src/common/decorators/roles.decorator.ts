import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

export const Roles = (...roles: RoleCode[]) => SetMetadata('roles', roles);
