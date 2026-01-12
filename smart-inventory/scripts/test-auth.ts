/**
 * Authentication System Test Script
 * 
 * This script tests the authentication utilities to ensure they work correctly.
 * Run with: npx tsx scripts/test-auth.ts
 */

import { hashPassword, verifyPassword } from "../src/lib/auth-utils";

async function testAuthUtils() {
  console.log("🧪 Testing Authentication Utilities...\n");

  // Test password hashing and verification
  const testPassword = "admin123";
  console.log(`Original password: ${testPassword}`);

  try {
    // Hash the password
    const hashedPassword = await hashPassword(testPassword);
    console.log(`Hashed password: ${hashedPassword}`);

    // Verify correct password
    const isValidCorrect = await verifyPassword(testPassword, hashedPassword);
    console.log(`✅ Correct password verification: ${isValidCorrect}`);

    // Verify incorrect password
    const isValidIncorrect = await verifyPassword("wrongpassword", hashedPassword);
    console.log(`❌ Incorrect password verification: ${isValidIncorrect}`);

    // Test edge cases
    const emptyPassword = await verifyPassword("", hashedPassword);
    console.log(`❌ Empty password verification: ${emptyPassword}`);

    console.log("\n🎉 All authentication utility tests passed!");

  } catch (error) {
    console.error("❌ Authentication test failed:", error);
    process.exit(1);
  }
}

// Run the tests
testAuthUtils();