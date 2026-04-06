/**
 * One-time admin setup script.
 * Removes seed users and creates a real admin account.
 *
 * Usage:
 *   npx tsx scripts/setup-admin.ts "Your Name" "you@email.com" "SecurePassword123!"
 */

import { PrismaClient } from '../src/generated/prisma';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_EMAILS = ['admin@example.com', 'salesman@example.com'];

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error(
      '\nUsage: npx tsx scripts/setup-admin.ts "Your Name" "you@email.com" "SecurePassword123!"\n'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('\n=== Admin Setup ===\n');

  // Look up ADMIN role
  const adminRole = await prisma.role.findFirst({
    where: { name: 'ADMIN' },
    select: { id: true },
  });

  if (!adminRole) {
    console.error('ADMIN role not found. Run: npx prisma db push && npm run db:seed first.');
    process.exit(1);
  }

  // Delete seed users
  const deleted = await prisma.user.deleteMany({
    where: { email: { in: SEED_EMAILS } },
  });
  console.log(`Deleted ${deleted.count} seed user(s): ${SEED_EMAILS.join(', ')}`);

  // Create new admin
  const hashed = hashSync(password, 12);
  const user = await prisma.user.create({
    data: {
      email:    email.toLowerCase(),
      name,
      password: hashed,
      isActive: true,
      role:     'ADMIN',
      roleId:   adminRole.id,
    },
    select: { id: true, email: true, name: true },
  });

  console.log(`\nCreated admin: ${user.name} <${user.email}>`);
  console.log('Setup complete. You can now log in.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
