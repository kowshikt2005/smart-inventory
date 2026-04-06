/**
 * Stock scan daemon script.
 * Run with: npx tsx scripts/stock-scan.ts
 *
 * Reads stock_scan_time from AppSetting (e.g. "21:00").
 * Checks every 60 seconds. Fires once per calendar day at the configured time.
 * Uses Prisma client directly — no HTTP dependency.
 */

import { PrismaClient } from '../src/generated/prisma';
import { runStockScan } from '../src/lib/reorder-utils';

const db = new PrismaClient();
let lastRunDate: string | null = null;

async function getScanTime(): Promise<string> {
  const setting = await db.appSetting.findUnique({
    where: { key: 'stock_scan_time' },
  });
  return setting?.value ?? '21:00';
}

async function tick() {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const scanTime = await getScanTime();

    if (currentTime === scanTime && lastRunDate !== today) {
      lastRunDate = today;
      console.log(`[${new Date().toISOString()}] Scan time matched (${scanTime}). Running stock scan...`);
      const result = await runStockScan(db);
      console.log(`[${new Date().toISOString()}] Scan complete:`, JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Tick error:`, err);
  }
}

console.log('[stock-scan] Daemon started. Polling every 60s...');
console.log('[stock-scan] Press Ctrl+C to stop.');
tick(); // immediate check on start
setInterval(tick, 60_000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[stock-scan] Shutting down...');
  await db.$disconnect();
  process.exit(0);
});
