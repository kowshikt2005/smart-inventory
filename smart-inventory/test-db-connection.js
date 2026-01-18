// Test database connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Attempting to connect to database...');
    console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Test query result:', result);
    
    // Test purchase orders table specifically
    try {
      const orders = await prisma.purchaseOrder.findMany({ take: 1 });
      console.log('✅ Purchase orders table accessible');
      console.log('Sample order count:', orders.length);
    } catch (error) {
      console.log('⚠️  Purchase orders table issue:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Database connection failed!');
    console.log('Error:', error.message);
    console.log('Code:', error.code);
    
    if (error.code === 'P2022') {
      console.log('\n🔧 Suggested fixes:');
      console.log('1. Verify DATABASE_URL in .env file is correct');
      console.log('2. Check if Railway database is running');
      console.log('3. Verify database credentials');
      console.log('4. Check firewall/network connectivity');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();