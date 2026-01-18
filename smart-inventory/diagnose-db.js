// Detailed database diagnostics
require('dotenv').config();

console.log('=== DATABASE DIAGNOSTICS ===\n');

// Check environment variables
console.log('1. Environment Variables Check:');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL length:', process.env.DATABASE_URL.length);
  console.log('DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 60) + '...');
  
  // Parse the connection string
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('Protocol:', url.protocol);
    console.log('Hostname:', url.hostname);
    console.log('Port:', url.port);
    console.log('Username:', url.username ? '***' : 'NOT SET');
    console.log('Password:', url.password ? '***' : 'NOT SET');
    console.log('Database:', url.pathname.substring(1));
  } catch (error) {
    console.log('❌ Invalid URL format:', error.message);
  }
}

console.log('\n2. Testing direct connection...');

const mysql = require('mysql2/promise');

async function testMySQLConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'gondola.proxy.rlwy.net',
      port: 55232,
      user: 'root',
      password: 'IkNJTmjyyxseblSyJhVdQQKbqlMRKbgG',
      database: 'railway',
      connectTimeout: 5000,
    });
    
    console.log('✅ MySQL connection successful!');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('Test query result:', rows);
    
    await connection.end();
  } catch (error) {
    console.log('❌ MySQL connection failed!');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔧 Possible causes:');
      console.log('- Railway database might be stopped');
      console.log('- Network/firewall blocking connection');
      console.log('- Incorrect port or hostname');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('🔧 Possible causes:');
      console.log('- Incorrect username/password');
      console.log('- Database user permissions issue');
    }
  }
}

testMySQLConnection();