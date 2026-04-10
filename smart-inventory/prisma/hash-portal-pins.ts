/**
 * Migration: hash existing plaintext portal PINs with bcrypt.
 *
 * Run BEFORE deploying the bcrypt-aware login / change-pin code:
 *
 *   npx tsx prisma/hash-portal-pins.ts
 *
 * Safe to run multiple times — it skips rows whose portalPassword already
 * starts with "$2" (bcrypt hash prefix).
 */
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const customers = await db.customer.findMany({
    where: { portalPassword: { not: null } },
    select: { id: true, portalPassword: true },
  });

  let hashed = 0;
  let skipped = 0;

  for (const c of customers) {
    const pin = c.portalPassword!;
    // Already hashed — skip
    if (pin.startsWith("$2")) {
      skipped++;
      continue;
    }
    const hash = await bcrypt.hash(pin, 12);
    await db.customer.update({
      where: { id: c.id },
      data: { portalPassword: hash },
    });
    hashed++;
  }

  console.log(`Done. Hashed: ${hashed}, already hashed (skipped): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
