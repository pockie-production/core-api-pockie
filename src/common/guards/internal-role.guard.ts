import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

@Injectable()
export class InternalRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Vui lòng đăng nhập.',
          details: null
        }
      });
    }

    const roles = user.roles || [];
    const hasInternalRole = roles.some((r: string) => 
      r === RoleCode.SUPER_ADMIN ||
      r === RoleCode.INTERNAL_ADMIN ||
      r === RoleCode.CONTENT_ADMIN ||
      r === RoleCode.SUPPORT_STAFF
    );

    if (!hasInternalRole) {
      throw new ForbiddenException({
        error: {
          code: 'INTERNAL_ACCESS_DENIED',
          message: 'Tài khoản này không có quyền truy cập Internal Console.',
          details: null
        }
      });
    }

    return true;
  }
}
