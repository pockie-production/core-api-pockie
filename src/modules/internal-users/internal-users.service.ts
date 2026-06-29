import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycStatus, OrganizationType, Prisma, RoleCode, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InternalUserAccountType,
  InternalUsersQueryDto,
  UpdateInternalUserStatusDto,
} from './dto/internal-users.dto';

const INTERNAL_ROLES: RoleCode[] = [
  RoleCode.SUPER_ADMIN,
  RoleCode.INTERNAL_ADMIN,
  RoleCode.CONTENT_ADMIN,
  RoleCode.SUPPORT_STAFF,
];

const BANK_ROLES: RoleCode[] = [
  RoleCode.BANK_ADMIN,
  RoleCode.BANK_MARKETER,
  RoleCode.BANK_ANALYST,
  RoleCode.BANK_VIEWER,
];

@Injectable()
export class InternalUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(query: InternalUsersQueryDto) {
    const where = this.buildWhere(query);
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [items, totalItems, summary] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          profile: true,
          roles: true,
          authIdentities: true,
          organizationMembers: {
            include: {
              organization: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.getSummary(),
    ]);

    return {
      items: items.map((user) => this.toListItem(user)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      summary,
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        roles: true,
        authIdentities: true,
        organizationMembers: {
          include: {
            organization: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            chatSessions: true,
            ocrJobs: true,
            EkycSession: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = await this.getPermissionsForRoles(user.roles.map((item) => item.role));

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      kycStatus: user.kycStatus,
      profile: {
        fullName: user.profile?.fullName || null,
        displayName: user.profile?.displayName || null,
      },
      roles: user.roles.map((item) => item.role),
      permissions,
      accountType: this.resolveAccountType(
        user.roles.map((item) => item.role),
        user.organizationMembers.map((item) => item.organization),
      ),
      organizationMemberships: user.organizationMembers.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationType: membership.organization.type,
        title: membership.title,
      })),
      stats: {
        chatSessions: user._count.chatSessions,
        ocrJobs: user._count.ocrJobs,
        ekycSessions: user._count.EkycSession,
      },
      authProvider: this.resolveAuthProvider(user.authIdentities, user.passwordHash),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUserStatus(id: string, actorUserId: string, dto: UpdateInternalUserStatusDto) {
    if (dto.status === UserStatus.DELETED) {
      throw new BadRequestException('Soft delete is not supported in phase 1.');
    }

    if (id === actorUserId && dto.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('You cannot suspend your own account.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        profile: true,
        authIdentities: true,
        organizationMembers: {
          include: {
            organization: true,
          },
        },
        _count: {
          select: {
            chatSessions: true,
            ocrJobs: true,
            EkycSession: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === dto.status) {
      return {
        message: 'User status unchanged.',
        user: await this.getUserDetail(id),
      };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          status: dto.status,
        },
      }),
      this.prisma.adminActionLog.create({
        data: {
          actorUserId,
          action: 'USER_STATUS_UPDATED',
          targetType: 'USER',
          targetId: id,
          payload: {
            previousStatus: user.status,
            newStatus: dto.status,
            reason: dto.reason || null,
          },
        },
      }),
    ]);

    return {
      message: 'User status updated successfully.',
      user: await this.getUserDetail(id),
    };
  }

  private buildWhere(query: InternalUsersQueryDto): Prisma.UserWhereInput {
    const andClauses: Prisma.UserWhereInput[] = [];

    if (query.q?.trim()) {
      const q = query.q.trim();
      andClauses.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { profile: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
          { profile: { is: { displayName: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }

    if (query.status) {
      andClauses.push({ status: query.status });
    }

    if (query.kycStatus) {
      andClauses.push({ kycStatus: query.kycStatus });
    }

    if (query.role) {
      andClauses.push({ roles: {
        some: {
          role: query.role as RoleCode,
        },
      } });
    }

    if (query.organizationId) {
      andClauses.push({ organizationMembers: {
        some: {
          organizationId: query.organizationId,
        },
      } });
    }

    if (query.accountType === InternalUserAccountType.INTERNAL) {
      andClauses.push({
        roles: {
          some: {
            role: { in: INTERNAL_ROLES },
          },
        },
      });
    }

    if (query.accountType === InternalUserAccountType.BANK) {
      andClauses.push({
        OR: [
          { roles: { some: { role: { in: BANK_ROLES } } } },
          { organizationMembers: { some: { organization: { type: OrganizationType.BANK } } } },
        ],
      });
    }

    if (query.accountType === InternalUserAccountType.END_USER) {
      andClauses.push(
        { roles: { some: { role: RoleCode.END_USER } } },
        { roles: { none: { role: { in: [...INTERNAL_ROLES, ...BANK_ROLES] } } } },
        { organizationMembers: { none: { organization: { type: OrganizationType.BANK } } } },
      );
    }

    if (!andClauses.length) {
      return {};
    }

    return { AND: andClauses };
  }

  private buildOrderBy(sortBy?: string, sortOrder?: string): Prisma.UserOrderByWithRelationInput {
    const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'email') {
      return { email: direction };
    }

    if (sortBy === 'status') {
      return { status: direction };
    }

    return { createdAt: direction };
  }

  private async getSummary() {
    const [totalUsers, activeUsers, suspendedUsers, verifiedUsers, allUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { kycStatus: KycStatus.VERIFIED } }),
      this.prisma.user.findMany({
        select: {
          id: true,
          roles: {
            select: {
              role: true,
            },
          },
          organizationMembers: {
            select: {
              organization: {
                select: {
                  type: true,
                },
              },
            },
          },
        },
      }),
    ]);

    let internalUsers = 0;
    let bankUsers = 0;
    for (const user of allUsers) {
      const accountType = this.resolveAccountType(
        user.roles.map((item) => item.role),
        user.organizationMembers.map((item) => item.organization),
      );
      if (accountType === InternalUserAccountType.INTERNAL) internalUsers += 1;
      if (accountType === InternalUserAccountType.BANK) bankUsers += 1;
    }

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      verifiedUsers,
      internalUsers,
      bankUsers,
    };
  }

  private async getPermissionsForRoles(roles: RoleCode[]) {
    if (!roles.length) return [];

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        role: { in: roles },
      },
      include: {
        permission: true,
      },
    });

    return Array.from(new Set(rows.map((item) => item.permission.code)));
  }

  private toListItem(user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: UserStatus;
    kycStatus: KycStatus;
    createdAt: Date;
    profile: { fullName: string | null; displayName: string | null } | null;
    roles: Array<{ role: RoleCode }>;
    authIdentities: Array<{ provider: string }>;
    organizationMembers: Array<{ organization: { id: string; name: string; type: OrganizationType } }>;
    passwordHash: string;
  }) {
    const roles = user.roles.map((item) => item.role);
    const organizations = user.organizationMembers.map((item) => item.organization);

    return {
      id: user.id,
      fullName: user.profile?.fullName || null,
      displayName: user.profile?.displayName || null,
      email: user.email,
      phone: user.phone,
      roles,
      accountType: this.resolveAccountType(roles, organizations),
      organization: organizations[0]
        ? {
            id: organizations[0].id,
            name: organizations[0].name,
            type: organizations[0].type,
          }
        : null,
      kycStatus: user.kycStatus,
      status: user.status,
      authProvider: this.resolveAuthProvider(user.authIdentities, user.passwordHash),
      createdAt: user.createdAt,
    };
  }

  private resolveAccountType(
    roles: RoleCode[],
    organizations: Array<{ type: OrganizationType }>,
  ): InternalUserAccountType {
    if (roles.some((role) => INTERNAL_ROLES.includes(role))) {
      return InternalUserAccountType.INTERNAL;
    }

    if (
      roles.some((role) => BANK_ROLES.includes(role)) ||
      organizations.some((organization) => organization.type === OrganizationType.BANK)
    ) {
      return InternalUserAccountType.BANK;
    }

    return InternalUserAccountType.END_USER;
  }

  private resolveAuthProvider(authIdentities: Array<{ provider: string }>, passwordHash: string) {
    if (authIdentities.length > 0) {
      return authIdentities[0].provider.toUpperCase();
    }

    return passwordHash ? 'PASSWORD' : 'UNKNOWN';
  }
}
