import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';

@Injectable()
export class RequireKycGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException('eKYC verification required');
    }
    return true;
  }
}
