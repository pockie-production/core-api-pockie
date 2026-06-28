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

  // 5. Seed Mock eKYC Data
  console.log('Seeding Mock eKYC Sessions...');
  
  // Create an end user for eKYC
  const ekycUserEmail = 'ekyc.user@pockie.local';
  const ekycUserHash = await bcrypt.hash('Password@123', 10);
  const ekycUser = await prisma.user.upsert({
    where: { email: ekycUserEmail },
    update: { kycStatus: 'PENDING' },
    create: {
      email: ekycUserEmail,
      passwordHash: ekycUserHash,
      kycStatus: 'PENDING',
    }
  });
  
  await prisma.userRole.upsert({
    where: { userId_role: { userId: ekycUser.id, role: RoleCode.END_USER } },
    update: {},
    create: { userId: ekycUser.id, role: RoleCode.END_USER }
  });

  await prisma.userProfile.upsert({
    where: { userId: ekycUser.id },
    update: { fullName: 'Nguyen Van A', displayName: 'Nguyen A' },
    create: { userId: ekycUser.id, fullName: 'Nguyen Van A', displayName: 'Nguyen A' }
  });

  // Create a pending session
  const session = await prisma.ekycSession.create({
    data: {
      userId: ekycUser.id,
      clientSession: 'mock_client_session',
      status: 'PENDING',
      finalDecision: 'PENDING',
      riskLevel: 'LOW',
    }
  });

  // Create OCR Result
  await prisma.ekycOcrResult.create({
    data: {
      sessionId: session.id,
      statusCode: 200,
      message: 'Success',
      documentType: 'CCCD_CHIP',
      tampering: [
        { code: 'id_quoc_huy_bi_catt', msg: 'Quốc huy bị cắt' }
      ],
      warnings: [
        { code: 'anh_dau_vao_mo_nhoe', msg: 'Ảnh đầu vào mờ nhòe' }
      ],
      fields: [
        { fieldName: 'id', fieldValue: '001099001122', fieldProb: 0.99 },
        { fieldName: 'name', fieldValue: 'NGUYỄN VĂN A', fieldProb: 0.99 },
        { fieldName: 'birth_day', fieldValue: '01/01/1990', fieldProb: 0.99 },
      ]
    }
  });

  // Create Liveness
  await prisma.ekycLivenessCardResult.create({
    data: {
      sessionId: session.id,
      liveness: 'success',
      livenessMsg: 'Real document',
      fakeLiveness: false,
      fakePrintPhoto: false,
      faceSwapping: false,
    }
  });

  await prisma.ekycFaceLivenessResult.create({
    data: {
      sessionId: session.id,
      liveness: 'success',
      livenessMsg: 'Real face',
      livenessProb: 0.05,
      blurFace: 'no',
      isEyeOpen: 'yes',
      multipleFaces: false,
    }
  });

  await prisma.ekycFaceCompareResult.create({
    data: {
      sessionId: session.id,
      msg: 'MATCH',
      prob: 0.99,
      matchWarning: 'no',
      multipleFaces: false,
    }
  });

  // Create Decision Log
  await prisma.ekycDecisionLog.create({
    data: {
      sessionId: session.id,
      decision: 'REVIEW',
      reason: 'Auto-evaluation: Tampering warning, Image quality warning',
    }
  });

  // Update session status to REVIEW_REQUIRED
  await prisma.ekycSession.update({
    where: { id: session.id },
    data: {
      status: 'REVIEW_REQUIRED',
      finalDecision: 'REVIEW',
      riskLevel: 'HIGH',
    }
  });

  console.log(`Seeded mock eKYC session: ${session.id}`);

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
