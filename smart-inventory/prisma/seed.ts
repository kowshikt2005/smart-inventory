import { PrismaClient } from "../src/generated/prisma";
import { hashPassword } from "../src/lib/auth-utils";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create initial admin user
  const adminEmail = "admin@smartinventory.com";
  const adminPassword = "admin123"; // Change this in production!

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log("✅ Admin user already exists");
  } else {
    const hashedPassword = await hashPassword(adminPassword);
    
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "System Administrator",
        password: hashedPassword,
        role: "ADMIN",
        isActive: true,
      },
    });

    console.log("✅ Created admin user:", {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
  }

  // Create initial employee record for admin
  const adminEmployeeNumber = "EMP-0001";
  const existingEmployee = await prisma.employee.findUnique({
    where: { employeeNumber: adminEmployeeNumber },
  });

  if (existingEmployee) {
    console.log("✅ Admin employee record already exists");
  } else {
    const adminEmployee = await prisma.employee.create({
      data: {
        employeeNumber: adminEmployeeNumber,
        name: "System Administrator",
        email: adminEmail,
        designation: "System Administrator",
        department: "IT",
        joinDate: new Date(),
        isActive: true,
      },
    });

    console.log("✅ Created admin employee record:", {
      id: adminEmployee.id,
      employeeNumber: adminEmployee.employeeNumber,
      name: adminEmployee.name,
    });
  }

  console.log("🎉 Database seed completed!");
  console.log("");
  console.log("📋 Admin Login Credentials:");
  console.log("   Email: admin@smartinventory.com");
  console.log("   Password: admin123");
  console.log("");
  console.log("⚠️  IMPORTANT: Change the admin password after first login!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });