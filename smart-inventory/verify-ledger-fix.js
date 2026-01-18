#!/usr/bin/env node
/**
 * Verification Script for Stock Ledger Fix
 * 
 * This script verifies that the stock ledger calculation is working correctly
 * by checking actual data in the database.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

async function verifyLedgerFix() {
  try {
    log('\n' + '='.repeat(80), 'bold');
    log('STOCK LEDGER FIX VERIFICATION', 'bold');
    log('='.repeat(80) + '\n', 'bold');

    // Get items with stock movements
    const itemsWithMovements = await prisma.item.findMany({
      where: {
        stockMovements: {
          some: {},
        },
      },
      include: {
        inventory: true,
        stockMovements: {
          orderBy: { createdAt: 'asc' },
        },
      },
      take: 5,
    });

    if (itemsWithMovements.length === 0) {
      logWarning('No items with stock movements found in database');
      return;
    }

    logInfo(`Found ${itemsWithMovements.length} items with stock movements\n`);

    let allPassed = true;

    for (const item of itemsWithMovements) {
      log(`\nChecking: ${item.itemCode} - ${item.name}`, 'bold');
      log('-'.repeat(80));

      const physicalStock = Number(item.inventory?.physicalStock || 0);
      
      // Calculate ledger balance using the same logic as API
      let runningBalance = 0;
      let totalIn = 0;
      let totalOut = 0;

      for (const movement of item.stockMovements) {
        const qty = Number(movement.quantity);

        if (qty < 0) {
          // Negative quantity = OUT
          totalOut += Math.abs(qty);
          runningBalance += qty;
        } else if (qty > 0) {
          // Positive quantity - check type
          if (['PURCHASE', 'ADJUSTMENT_IN', 'RETURN'].includes(movement.type)) {
            totalIn += qty;
            runningBalance += qty;
          } else if (['SALE', 'ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER'].includes(movement.type)) {
            totalOut += qty;
            runningBalance -= qty;
          }
        }
      }

      // Display results
      logInfo(`  Physical Stock: ${physicalStock}`);
      logInfo(`  Total In: ${totalIn}`);
      logInfo(`  Total Out: ${totalOut}`);
      logInfo(`  Calculated Balance: ${runningBalance}`);

      // Verify match
      if (runningBalance === physicalStock) {
        logSuccess(`  Balance matches physical stock!`);
      } else {
        logError(`  Balance mismatch! Expected: ${physicalStock}, Got: ${runningBalance}`);
        allPassed = false;
      }

      // Check for negative quantities (old data)
      const negativeMovements = item.stockMovements.filter(m => Number(m.quantity) < 0);
      if (negativeMovements.length > 0) {
        logWarning(`  Found ${negativeMovements.length} movements with negative quantities (old data)`);
      }

      // Check for positive SALE movements (new data)
      const positiveSales = item.stockMovements.filter(
        m => Number(m.quantity) > 0 && m.type === 'SALE'
      );
      if (positiveSales.length > 0) {
        logSuccess(`  Found ${positiveSales.length} SALE movements with positive quantities (new format)`);
      }
    }

    // Final summary
    log('\n' + '='.repeat(80), 'bold');
    if (allPassed) {
      logSuccess('ALL CHECKS PASSED! Stock ledger is working correctly.');
    } else {
      logError('SOME CHECKS FAILED! Please review the output above.');
    }
    log('='.repeat(80) + '\n', 'bold');

    // Additional info
    log('\nNext Steps:', 'bold');
    log('1. Start the dev server: npm run dev');
    log('2. Navigate to Ledger → Stock Ledger');
    log('3. Select an item and click "View Ledger"');
    log('4. Verify that:');
    log('   - Sales show in "Out Qty" column');
    log('   - Purchases show in "In Qty" column');
    log('   - Running balance is correct');
    log('   - Closing balance matches physical stock\n');

  } catch (error) {
    logError(`\nError during verification: ${error.message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyLedgerFix();
