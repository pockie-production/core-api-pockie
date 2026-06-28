import { PrismaClient, RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Define standard permissions for END_USER
  const endUserPermissions = [
    { code: 'auth:login', description: 'Can login' },
    { code: 'chat:access', description: 'Can access chat feature' },
    { code: 'pet:interact', description: 'Can interact with pet' },
  ];

  // 2. Define internal permissions
  const internalPermissions = [
    'dashboard.read',
    'users.read',
    'users.update_status',
    'ekyc.read',
    'ekyc.read_limited',
    'ekyc.request_retry',
    'ekyc.manual_approve',
    'ekyc.reject',
    'trends.read',
    'trends.sync',
    'trends.approve',
    'trends.reject',
    'trends.deploy',
    'vouchers.read',
    'vouchers.create',
    'vouchers.update',
    'vouchers.delete',
    'organizations.read',
    'organizations.create',
    'organizations.update',
    'campaigns.read',
    'campaigns.update_status',
    'analytics.read',
    'audit.read',
    'audit.read_limited',
    'system.settings.read',
    'system.settings.update',
  ].map(code => ({ code, description: `Permission for ${code}` }));

  const allPermissions = [...endUserPermissions, ...internalPermissions];

  // Insert permissions
  for (const p of allPermissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, description: p.description },
    });
  }

  // 3. Define Roles and their Permissions
  const rolePermissionsMap: Record<RoleCode, string[]> = {
    [RoleCode.SUPER_ADMIN]: internalPermissions.map(p => p.code),
    [RoleCode.INTERNAL_ADMIN]: [
      'dashboard.read', 'users.read', 'users.update_status', 'ekyc.read', 'ekyc.request_retry',
      'ekyc.reject', 'organizations.read', 'organizations.create', 'organizations.update',
      'vouchers.read', 'vouchers.create', 'vouchers.update', 'campaigns.read',
      'campaigns.update_status', 'analytics.read', 'audit.read'
    ],
    [RoleCode.CONTENT_ADMIN]: [
      'dashboard.read', 'trends.read', 'trends.sync', 'trends.approve', 'trends.reject',
      'trends.deploy', 'vouchers.read', 'vouchers.create', 'vouchers.update', 'analytics.read'
    ],
    [RoleCode.SUPPORT_STAFF]: [
      'dashboard.read', 'users.read', 'ekyc.read_limited', 'ekyc.request_retry', 'audit.read_limited'
    ],
    [RoleCode.END_USER]: endUserPermissions.map(p => p.code),
    [RoleCode.BANK_ADMIN]: [],
    [RoleCode.BANK_MARKETER]: [],
    [RoleCode.BANK_ANALYST]: [],
    [RoleCode.BANK_VIEWER]: []
  };

  // Insert role permissions
  for (const [roleStr, permCodes] of Object.entries(rolePermissionsMap)) {
    const role = roleStr as RoleCode;
    for (const code of permCodes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            role_permissionId: { role, permissionId: permission.id },
          },
          update: {},
          create: { role, permissionId: permission.id },
        });
      }
    }
  }

  // 4. Seed Users
  const usersToSeed = [
    {
      email: 'superadmin@pockie.local',
      password: 'Admin@123456',
      role: RoleCode.SUPER_ADMIN,
      fullName: 'Pockie Super Admin',
      displayName: 'Super Admin'
    },
    {
      email: 'ops@pockie.local',
      password: 'Ops@123456',
      role: RoleCode.INTERNAL_ADMIN,
      fullName: 'Pockie Operations Admin',
      displayName: 'Ops Admin'
    },
    {
      email: 'content@pockie.local',
      password: 'Content@123456',
      role: RoleCode.CONTENT_ADMIN,
      fullName: 'Pockie Content Admin',
      displayName: 'Content Admin'
    },
    {
      email: 'support@pockie.local',
      password: 'Support@123456',
      role: RoleCode.SUPPORT_STAFF,
      fullName: 'Pockie Support Staff',
      displayName: 'Support Staff'
    }
  ];

  for (const u of usersToSeed) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    
    // Upsert User
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash },
      create: {
        email: u.email,
        passwordHash,
      }
    });

    // Ensure Role
    await prisma.userRole.upsert({
      where: {
        userId_role: { userId: user.id, role: u.role }
      },
      update: {},
      create: { userId: user.id, role: u.role }
    });

    // Ensure Profile
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { fullName: u.fullName, displayName: u.displayName },
      create: { userId: user.id, fullName: u.fullName, displayName: u.displayName }
    });

    console.log(`Seeded user: ${u.email} [${u.role}]`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
