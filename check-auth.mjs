import bcrypt from 'bcryptjs';
import { PrismaClient } from './smart-inventory/src/generated/prisma/index.js';

const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: 'admin@example.com' } });

if (!user) {
  console.log('USER NOT FOUND IN DB');
} else {
  console.log('User found. isActive:', user.isActive);
  const match = await bcrypt.compare('password123', user.password);
  console.log('Password matches:', match);
}

await db.$disconnect();
