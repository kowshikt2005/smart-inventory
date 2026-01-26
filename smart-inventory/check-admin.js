const { PrismaClient } = require('./src/generated/prisma');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@smartinventory.com' }
  });

  if (user) {
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Name:', user.name);
    console.log('  Role:', user.role);
    console.log('  isActive:', user.isActive);
    console.log('  Password hash:', user.password);
    console.log('  Password hash length:', user.password.length);
    console.log('  Starts with $2:', user.password.startsWith('$2'));

    // Test password verification
    const testPassword = 'admin123';
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log('\n  Testing password "admin123":');
    console.log('  Password matches:', isMatch);
  } else {
    console.log('No user found with email: admin@smartinventory.com');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
