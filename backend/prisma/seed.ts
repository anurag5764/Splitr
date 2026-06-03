import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@test.com' },
    update: {},
    create: {
      name: 'Alice',
      email: 'alice@test.com',
      passwordHash,
      currency: 'USD',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {},
    create: {
      name: 'Bob',
      email: 'bob@test.com',
      passwordHash,
      currency: 'USD',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@test.com' },
    update: {},
    create: {
      name: 'Charlie',
      email: 'charlie@test.com',
      passwordHash,
      currency: 'USD',
    },
  });

  console.log('Seeding finished.');
  console.log('Test Accounts:');
  console.log('- Alice (alice@test.com / password123)');
  console.log('- Bob (bob@test.com / password123)');
  console.log('- Charlie (charlie@test.com / password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
