import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Create or update SUPER_ADMIN user
  const adminEmail = 'admin@pockie.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!admin) {
    // Note: In reality, use bcrypt to hash this password. This is just for seeding.
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: '$2b$10$EPqR0Y6X/O1B.O6s6fI9u.Q0/vW.l/H0TjD4l6xYyV/Z1S3Jt.3h2', // 'password'
        roles: {
          create: {
            role: RoleCode.SUPER_ADMIN,
          },
        },
      },
    });
    console.log(`Created admin user with email: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists`);
  }

  // 2. Define standard permissions for END_USER
  const permissions = [
    { code: 'auth:login', description: 'Can login' },
    { code: 'chat:access', description: 'Can access chat feature' },
    { code: 'pet:interact', description: 'Can interact with pet' },
  ];

  for (const p of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        description: p.description,
      },
    });

    // Assign to END_USER
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: RoleCode.END_USER,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        role: RoleCode.END_USER,
        permissionId: permission.id,
      },
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
