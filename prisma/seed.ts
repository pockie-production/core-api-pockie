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
  
  const ekycUserEmail = 'ekyc.user@pockie.local';
  const ekycUserHash = await bcrypt.hash('Password@123', 10);
  const ekycUser = await prisma.user.upsert({
    where: { email: ekycUserEmail },
    update: { kycStatus: 'PENDING' },
    create: { email: ekycUserEmail, passwordHash: ekycUserHash, kycStatus: 'PENDING' }
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

  async function createMockSession(status: string, finalDecision: string, riskLevel: string, overrideOcr: any = {}, overrideCard: any = {}, overrideFace: any = {}, overrideCompare: any = {}, reason: string) {
    const session = await prisma.ekycSession.create({
      data: {
        userId: ekycUser.id,
        clientSession: 'mock_client_session_' + Date.now() + Math.floor(Math.random() * 1000),
        status: status as any,
        finalDecision: finalDecision as any,
        riskLevel: riskLevel as any,
      }
    });

    await prisma.ekycOcrResult.create({
      data: {
        sessionId: session.id,
        statusCode: 200,
        message: 'Success',
        tampering: {
          create: overrideOcr.tampering || []
        },
        warnings: {
          create: overrideOcr.warnings || []
        },
        fields: {
          create: [
            { fieldName: 'id', fieldValue: '001099001122', probability: 0.99 },
            { fieldName: 'name', fieldValue: 'NGUYỄN VĂN A', probability: 0.99 },
            { fieldName: 'birth_day', fieldValue: '01/01/1990', probability: 0.99 },
          ]
        }
      }
    });

    await prisma.ekycLivenessCardResult.create({
      data: {
        sessionId: session.id,
        liveness: overrideCard.liveness || 'success',
        livenessMsg: 'Real document',
        fakeLiveness: overrideCard.fakeLiveness || false,
        fakePrintPhoto: false,
        faceSwapping: overrideCard.faceSwapping || false,
      }
    });

    await prisma.ekycFaceLivenessResult.create({
      data: {
        sessionId: session.id,
        liveness: overrideFace.liveness || 'success',
        livenessMsg: 'Real face',
        livenessProb: 0.05,
        blurFace: overrideFace.blurFace || 'no',
        isEyeOpen: 'yes',
        multipleFaces: overrideFace.multipleFaces || false,
      }
    });

    await prisma.ekycFaceCompareResult.create({
      data: {
        sessionId: session.id,
        msg: overrideCompare.msg || 'MATCH',
        prob: 0.99,
        matchWarning: overrideCompare.matchWarning || 'no',
        multipleFaces: false,
      }
    });

    await prisma.ekycMaskResult.create({
        data: {
            sessionId: session.id,
            masked: overrideFace.masked || 'no'
        }
    });

    await prisma.ekycDecisionLog.create({
      data: {
        sessionId: session.id,
        decision: finalDecision as any,
        reason: reason,
      }
    });
    console.log(`Seeded mock case (${finalDecision}): ${session.id}`);
  }

  // 10 mock cases
  // 3 VERIFIED
  await createMockSession('VERIFIED', 'PASS', 'LOW', {}, {}, {}, {}, 'Auto-approval');
  await createMockSession('VERIFIED', 'PASS', 'LOW', {}, {}, {}, {}, 'Auto-approval');
  await createMockSession('VERIFIED', 'PASS', 'LOW', {}, {}, {}, {}, 'Auto-approval');
  
  // 3 REVIEW_REQUIRED
  await createMockSession('REVIEW_REQUIRED', 'REVIEW', 'MEDIUM', { warnings: [{ code: 'id_xac_suat_thap', msg: 'ID confidence is low' }] }, {}, {}, {}, 'Warning found: id_xac_suat_thap');
  await createMockSession('REVIEW_REQUIRED', 'REVIEW', 'MEDIUM', {}, {}, { masked: 'yes' }, {}, 'Warning found: mask face detected');
  await createMockSession('REVIEW_REQUIRED', 'REVIEW', 'MEDIUM', {}, {}, {}, { matchWarning: 'yes' }, 'Warning found: face match warning');
  
  // 2 RETRY_REQUIRED
  await createMockSession('RETRY_REQUIRED', 'RETRY', 'MEDIUM', { warnings: [{ code: 'anh_dau_vao_mo_nhoe', msg: 'Image blurred' }] }, {}, {}, {}, 'Retry required: image blurred');
  await createMockSession('RETRY_REQUIRED', 'RETRY', 'MEDIUM', {}, {}, { multipleFaces: true }, {}, 'Retry required: multiple faces detected');
  
  // 2 REJECTED
  await createMockSession('REJECTED', 'FAIL', 'HIGH', {}, {}, {}, { msg: 'NOMATCH' }, 'Rejection: Face mismatch');
  await createMockSession('REJECTED', 'FAIL', 'CRITICAL', {}, { fakeLiveness: true }, {}, {}, 'Rejection: Fake document liveness detected');

  // 6. Seed Gamification Level Rules & Missions
  console.log('Seeding Gamification Level Rules & Missions...');
  await prisma.levelRule.upsert({ where: { level: 1 }, update: {}, create: { level: 1, requiredTotalXp: 0, title: 'Newbie' } });
  await prisma.levelRule.upsert({ where: { level: 2 }, update: {}, create: { level: 2, requiredTotalXp: 100, title: 'Explorer' } });
  await prisma.levelRule.upsert({ where: { level: 3 }, update: {}, create: { level: 3, requiredTotalXp: 300, title: 'Pro' } });

  const missionDaily1 = await prisma.mission.upsert({
    where: { code: 'mission_daily_1' },
    update: {},
    create: { code: 'mission_daily_1', title: 'Đăng nhập hôm nay', description: 'Đăng nhập vào ứng dụng', missionType: 'DAILY', xpReward: 10, targetValue: 1, metadata: { requiresConfirm: false } }
  });
  const missionDaily2 = await prisma.mission.upsert({
    where: { code: 'mission_daily_2' },
    update: {},
    create: { code: 'mission_daily_2', title: 'Đọc 1 bài báo', description: 'Đọc kiến thức tài chính', missionType: 'DAILY', xpReward: 20, targetValue: 1, metadata: { requiresConfirm: true } }
  });

  // 7. Seed End-user Finance & Gamification Profiles
  console.log('Seeding End-user Dashboard Data...');
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Upsert profile for ekycUser
  await prisma.userGamificationProfile.upsert({
    where: { userId: ekycUser.id },
    update: {},
    create: { userId: ekycUser.id, totalXp: 150, currentXp: 150, level: 2, currentStreakDays: 3, longestStreakDays: 5 }
  });

  // Wallet does not have userId_currency unique constraint, so we might query first or use findFirst
  let wallet = await prisma.wallet.findFirst({ where: { userId: ekycUser.id, currency: 'VND' } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: ekycUser.id, balance: 5000000, currency: 'VND', name: 'Ví Tiền Mặt' }
    });
  }

  const catFood = await prisma.financialCategory.upsert({
    where: { code: 'cat_food' },
    update: {},
    create: { code: 'cat_food', name: 'Ăn uống', icon: '🍔', type: 'EXPENSE', isSystem: true }
  });

  const catTransport = await prisma.financialCategory.upsert({
    where: { code: 'cat_transport' },
    update: {},
    create: { code: 'cat_transport', name: 'Đi lại', icon: '🚗', type: 'EXPENSE', isSystem: true }
  });

  await prisma.monthlyBudget.upsert({
    where: { userId_month: { userId: ekycUser.id, month: currentMonth } },
    update: {},
    create: { userId: ekycUser.id, month: currentMonth, totalBudget: 10000000, currency: 'VND' }
  });

  // Check if transactions exist to avoid duplicates
  const existingTxCount = await prisma.financialTransaction.count({ where: { userId: ekycUser.id } });
  if (existingTxCount === 0) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    await prisma.financialTransaction.createMany({
      data: [
        { userId: ekycUser.id, walletId: wallet.id, categoryId: catFood.id, amount: 50000, currency: 'VND', transactionType: 'EXPENSE', title: 'Ăn sáng', transactionDate: today },
        { userId: ekycUser.id, walletId: wallet.id, categoryId: catFood.id, amount: 150000, currency: 'VND', transactionType: 'EXPENSE', title: 'Ăn trưa', transactionDate: yesterday },
        { userId: ekycUser.id, walletId: wallet.id, categoryId: catTransport.id, amount: 500000, currency: 'VND', transactionType: 'EXPENSE', title: 'Đổ xăng', transactionDate: yesterday },
      ]
    });
  }

  // Seed notification
  const notifCount = await prisma.notification.count({ where: { userId: ekycUser.id } });
  if (notifCount === 0) {
    await prisma.notification.create({
      data: {
        userId: ekycUser.id,
        title: 'Chào mừng bạn đến với Pockie',
        body: 'Khám phá các tính năng tài chính mới ngay hôm nay!',
        type: 'SYSTEM',
      }
    });
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
