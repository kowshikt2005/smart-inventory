import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { ENTITY_FIELDS, type EntityType } from '@/lib/import-utils';
import { generateJournalNumber, generatePaymentNumber } from '@/lib/invoice-utils';
import { generateVendorPaymentNumber } from '@/lib/purchase-utils';
import { SYSTEM_USER_ID } from '@/lib/order-utils';
import { checkAuth } from '@/lib/api-auth';
// ── helpers ──────────────────────────────────────────────

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function num(v: unknown): number {
  // Strips commas and takes the first numeric token (handles "9,198.82" and "2.50 219.02" Tally format)
  const s = v === null || v === undefined ? '' : String(v).replace(/,/g, '').trim();
  const first = s.split(/\s+/)[0];
  const n = Number(first);
  return isNaN(n) ? 0 : n;
}

function parseDate(v: unknown): Date {
  if (!v) return new Date();
  // handle Excel serial dates (numbers like 45678)
  const n = Number(v);
  if (!isNaN(n) && n > 10000 && n < 100000) {
    // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
    return new Date(Date.UTC(1899, 11, 30 + n));
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? new Date() : d;
}

function ciMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ── FK lookup caches ─────────────────────────────────────

interface RefData {
  customers: { id: string; name: string; gstin: string | null; creditDays: number }[];
  vendors: { id: string; name: string; gstin: string | null }[];
  brands: { id: string; name: string }[];
  subBrands: { id: string; name: string; brandId: string }[];
  items: { id: string; name: string; itemCode: string; userCode: string | null; hsnCode: string | null; brandId: string | null; subBrandId: string | null; gstRate: any; inventory: { id: string } | null }[];
  bankAccounts: { id: string; accountName: string }[];
}

async function loadRefData(): Promise<RefData> {
  const [customers, vendors, brands, subBrands, items, bankAccounts] = await Promise.all([
    db.customer.findMany({ select: { id: true, name: true, gstin: true, creditDays: true } }),
    db.vendor.findMany({ select: { id: true, name: true, gstin: true } }),
    db.brand.findMany({ select: { id: true, name: true } }),
    db.subBrand.findMany({ select: { id: true, name: true, brandId: true } }),
    db.item.findMany({ select: { id: true, name: true, itemCode: true, userCode: true, hsnCode: true, brandId: true, subBrandId: true, gstRate: true, inventory: { select: { id: true } } } }),
    db.bankAccount.findMany({ select: { id: true, accountName: true } }),
  ]);
  return { customers, vendors, brands, subBrands, items, bankAccounts };
}

function findCustomer(ref: RefData, nameOrGstin: string) {
  const s = str(nameOrGstin);
  return ref.customers.find(c => ciMatch(c.name, s)) || ref.customers.find(c => c.gstin && ciMatch(c.gstin, s));
}

function findVendor(ref: RefData, nameOrGstin: string) {
  const s = str(nameOrGstin);
  return ref.vendors.find(v => ciMatch(v.name, s)) || ref.vendors.find(v => v.gstin && ciMatch(v.gstin, s));
}

function findItem(ref: RefData, nameOrCode: string, hsnCode?: string) {
  const s = str(nameOrCode);
  return ref.items.find(i => i.userCode && ciMatch(i.userCode, s))
    || ref.items.find(i => ciMatch(i.itemCode, s))
    || ref.items.find(i => ciMatch(i.name, s))
    // fallback: match by HSN if provided and name/code lookup failed
    || (hsnCode ? ref.items.find(i => i.hsnCode && ciMatch(i.hsnCode, hsnCode)) : undefined);
}

function findBrand(ref: RefData, name: string) {
  return ref.brands.find(b => ciMatch(b.name, str(name)));
}

function findSubBrand(ref: RefData, name: string, brandId: string) {
  return ref.subBrands.find(sb => ciMatch(sb.name, str(name)) && sb.brandId === brandId);
}

function findBankAccount(ref: RefData, name: string) {
  return ref.bankAccounts.find(b => ciMatch(b.accountName, str(name)));
}

// ── tax calculation helper ───────────────────────────────
// Priority: cgstRate+sgstRate > taxRate > item gstRate
// num() handles comma-formatted values and Tally "rate amount" cells by taking the first token
function calcLineTax(row: Record<string, unknown>, lineAmount: number, item: { gstRate: any } | undefined): { taxRate: number; taxAmount: number } {
  const explicitRate = str(row.taxRate) !== '' ? num(row.taxRate) : null;
  const cgstSgstRate = (str(row.cgstRate) !== '' || str(row.sgstRate) !== '')
    ? num(row.cgstRate) + num(row.sgstRate)
    : null;
  const taxRate = explicitRate ?? cgstSgstRate ?? (item ? Number(item.gstRate) : 0);
  const taxAmount = Math.round(lineAmount * (taxRate / 100) * 100) / 100;
  return { taxRate, taxAmount };
}

// ── validate action ──────────────────────────────────────

interface RowResult {
  rowIndex: number;
  status: 'valid' | 'error' | 'warning';
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  resolvedData: Record<string, unknown>;
}

async function validateRows(entityType: EntityType, rows: Record<string, unknown>[]): Promise<RowResult[]> {
  const fields = ENTITY_FIELDS[entityType];
  const ref = await loadRefData();
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: { field: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];
    const resolved: Record<string, unknown> = { ...row };

    // required / type checks
    for (const field of fields) {
      const val = row[field.key];
      const isEmpty = val === undefined || val === null || str(val) === '';

      if (field.required && isEmpty) {
        errors.push({ field: field.key, message: `${field.label} is required` });
        continue;
      }
      if (isEmpty) continue;

      const sv = str(val);

      if (field.maxLength && sv.length > field.maxLength) {
        errors.push({ field: field.key, message: `${field.label} max ${field.maxLength} chars` });
      }

      if ((field.type === 'number' || field.type === 'decimal') && isNaN(Number(sv))) {
        errors.push({ field: field.key, message: `${field.label} must be a number` });
      }

      if (field.type === 'date') {
        const d = parseDate(sv);
        if (isNaN(d.getTime())) errors.push({ field: field.key, message: `${field.label} invalid date` });
      }

      if (field.type === 'enum' && field.enumValues) {
        const upper = sv.toUpperCase().replace(/[\s-]+/g, '_');
        if (!field.enumValues.includes(upper)) {
          errors.push({ field: field.key, message: `${field.label} must be one of: ${field.enumValues.join(', ')}` });
        }
      }
    }

    // FK resolution
    if (entityType === 'CUSTOMER' || entityType === 'VENDOR') {
      // check duplicate gstin
      const gstin = str(row.gstin);
      if (gstin) {
        if (gstin.length !== 15) warnings.push({ field: 'gstin', message: 'GSTIN should be 15 characters' });
        const existing = entityType === 'CUSTOMER'
          ? ref.customers.find(c => c.gstin && ciMatch(c.gstin, gstin))
          : ref.vendors.find(v => v.gstin && ciMatch(v.gstin, gstin));
        if (existing) warnings.push({ field: 'gstin', message: `Duplicate GSTIN — already exists for "${existing.name}"` });
      }
    }

    if (entityType === 'ITEM') {
      const brand = findBrand(ref, str(row.brandName));
      if (!brand) {
        warnings.push({ field: 'brandName', message: `Brand "${str(row.brandName)}" not found — will be stored as text` });
      } else {
        resolved._brandId = brand.id;
        const sbName = str(row.subBrandName);
        if (!sbName) {
          // No sub-brand provided — will be auto-assigned on resolve
          warnings.push({ field: 'subBrandName', message: `No sub-brand name — will be auto-assigned on resolve` });
        } else {
          const subBrand = findSubBrand(ref, sbName, brand.id);
          if (!subBrand) {
            warnings.push({ field: 'subBrandName', message: `Sub-Brand "${sbName}" not found under "${brand.name}" — will be stored as text` });
          } else {
            resolved._subBrandId = subBrand.id;
          }
        }
      }
      // duplicate check
      const uc = str(row.userCode);
      if (uc && ref.items.find(it => it.userCode && ciMatch(it.userCode, uc))) {
        warnings.push({ field: 'userCode', message: 'User code already exists' });
      }
    }

    if (entityType === 'STOCK_JOURNAL') {
      const item = findItem(ref, str(row.itemName));
      if (!item) errors.push({ field: 'itemName', message: `Item "${str(row.itemName)}" not found` });
      else resolved._itemId = item.id;
    }

    if (entityType === 'PAYMENT') {
      const cust = findCustomer(ref, str(row.customerName));
      if (!cust) errors.push({ field: 'customerName', message: `Customer "${str(row.customerName)}" not found` });
      else resolved._customerId = cust.id;

      const bankName = str(row.bankAccountName);
      if (bankName) {
        const bank = findBankAccount(ref, bankName);
        if (!bank) warnings.push({ field: 'bankAccountName', message: `Bank account "${bankName}" not found` });
        else resolved._bankAccountId = bank.id;
      }
    }

    if (entityType === 'VENDOR_PAYMENT') {
      const vend = findVendor(ref, str(row.vendorName));
      if (!vend) errors.push({ field: 'vendorName', message: `Vendor "${str(row.vendorName)}" not found` });
      else resolved._vendorId = vend.id;

      const bankName = str(row.bankAccountName);
      if (bankName) {
        const bank = findBankAccount(ref, bankName);
        if (!bank) warnings.push({ field: 'bankAccountName', message: `Bank account "${bankName}" not found` });
        else resolved._bankAccountId = bank.id;
      }
    }

    if (entityType === 'SALES_INVOICE') {
      // Customer: try by name first, then by GSTIN fallback
      const custByName = findCustomer(ref, str(row.customerName));
      const cust = custByName || (row.customerGstin ? findCustomer(ref, str(row.customerGstin)) : undefined);
      if (!cust) warnings.push({ field: 'customerName', message: `Customer "${str(row.customerName)}" not found — will be stored as text` });
      else resolved._customerId = cust.id;

      // Item: try by name or itemCode, then HSN fallback
      const itemLookup = str(row.itemCode) || str(row.itemName);
      const item = findItem(ref, itemLookup, str(row.hsnCode));
      if (!item) warnings.push({ field: 'itemName', message: `Item "${str(row.itemName)}" not found — will be stored as text` });
      else {
        resolved._itemId = item.id;
        resolved._gstRate = Number(item.gstRate);
        resolved._inventoryId = item.inventory?.id;
      }
    }

    if (entityType === 'PURCHASE_INVOICE') {
      // Vendor: try by name first, then by GSTIN fallback
      const vendByName = findVendor(ref, str(row.vendorName));
      const vend = vendByName || (row.vendorGstin ? findVendor(ref, str(row.vendorGstin)) : undefined);
      if (!vend) warnings.push({ field: 'vendorName', message: `Vendor "${str(row.vendorName)}" not found — will be stored as text` });
      else resolved._vendorId = vend.id;

      // Item: try by name or itemCode, then HSN fallback
      const itemLookup = str(row.itemCode) || str(row.itemName);
      const item = findItem(ref, itemLookup, str(row.hsnCode));
      if (!item) warnings.push({ field: 'itemName', message: `Item "${str(row.itemName)}" not found — will be stored as text` });
      else {
        resolved._itemId = item.id;
        resolved._gstRate = Number(item.gstRate);
        resolved._inventoryId = item.inventory?.id;
      }
    }

    results.push({
      rowIndex: i,
      status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
      errors,
      warnings,
      resolvedData: resolved,
    });
  }

  return results;
}

// ── import action ────────────────────────────────────────

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; field: string; message: string }[];
}

async function importRows(entityType: EntityType, rows: Record<string, unknown>[]): Promise<ImportResult> {
  const ref = await loadRefData();
  const result: ImportResult = { success: 0, failed: 0, errors: [] };
  const BATCH = 50;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH) {
    const batch = rows.slice(batchStart, batchStart + BATCH);

    switch (entityType) {
      case 'CUSTOMER':
        await importCustomers(batch, batchStart, result);
        break;
      case 'VENDOR':
        await importVendors(batch, batchStart, result);
        break;
      case 'ITEM':
        await importItems(batch, batchStart, ref, result);
        break;
      case 'EMPLOYEE':
        await importEmployees(batch, batchStart, result);
        break;
      case 'STOCK_JOURNAL':
        await importStockJournals(batch, batchStart, ref, result);
        break;
      case 'PAYMENT':
        await importPayments(batch, batchStart, ref, result);
        break;
      case 'VENDOR_PAYMENT':
        await importVendorPayments(batch, batchStart, ref, result);
        break;
      case 'SALES_INVOICE':
        await importSalesInvoices(batch, batchStart, ref, result);
        break;
      case 'PURCHASE_INVOICE':
        await importPurchaseInvoices(batch, batchStart, ref, result);
        break;
    }
  }

  return result;
}

// ── entity importers ─────────────────────────────────────

async function importCustomers(batch: Record<string, unknown>[], offset: number, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      await db.customer.create({
        data: {
          customerNumber: `customer-${Date.now()}-${i}`,
          name: str(row.name),
          gstin: str(row.gstin) || null,
          email: str(row.email) || null,
          phone: str(row.phone) || null,
          address: str(row.address) || null,
          city: str(row.city) || null,
          state: str(row.state) || null,
          pincode: str(row.pincode) || null,
          openingBalance: num(row.openingBalance),
          creditLimit: num(row.creditLimit),
          creditDays: Math.round(num(row.creditDays)),
          status: 'ACTIVE',
        },
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create customer' });
    }
  }
}

async function importVendors(batch: Record<string, unknown>[], offset: number, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      await db.vendor.create({
        data: {
          vendorNumber: `vendor-${Date.now()}-${i}`,
          name: str(row.name),
          gstin: str(row.gstin) || null,
          email: str(row.email) || null,
          phone: str(row.phone) || null,
          address: str(row.address) || null,
          city: str(row.city) || null,
          state: str(row.state) || null,
          pincode: str(row.pincode) || null,
          openingBalance: num(row.openingBalance),
          creditDays: Math.round(num(row.creditDays)),
          isActive: true,
        },
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create vendor' });
    }
  }
}

async function importItems(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      const brand = findBrand(ref, str(row.brandName));
      const subBrandName = str(row.subBrandName); // may be empty for items with no sub-brand
      const subBrand = (brand && subBrandName) ? findSubBrand(ref, subBrandName, brand.id) : null;
      const isImported = !brand || !subBrand;

      await transaction(async (tx) => {
        const item = await (tx.item.create as any)({
          data: {
            itemCode: `item-${Date.now()}-${i}`,
            userCode: str(row.userCode) || null,
            name: str(row.name),
            description: str(row.description) || null,
            brandId: brand?.id || null,
            subBrandId: subBrand?.id || null,
            importedBrandName: !brand ? str(row.brandName) || null : null,
            importedSubBrandName: !subBrand ? (subBrandName || null) : null,
            isImported,
            hsnCode: str(row.hsnCode) || null,
            gstRate: num(row.gstRate),
            purchasePrice: num(row.purchasePrice),
            mrp: num(row.mrp),
            sellingPrice: num(row.sellingPrice) || num(row.mrp),
            minStock: num(row.minStock),
            unit: str(row.unit) || 'PCS',
            isActive: true,
          },
        });
        await tx.inventory.create({
          data: {
            itemId: item.id,
            physicalStock: 0,
            reservedQuantity: 0,
            minStockLevel: num(row.minStock),
          },
        });
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create item' });
    }
  }
}

async function importEmployees(batch: Record<string, unknown>[], offset: number, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      await db.employee.create({
        data: {
          employeeNumber: `EMP-${Date.now()}-${i}`,
          name: str(row.name),
          email: str(row.email) || null,
          phone: str(row.phone) || null,
          designation: str(row.designation) || null,
          department: str(row.department) || null,
          salary: row.salary ? num(row.salary) : null,
          joinDate: parseDate(row.joinDate),
          isActive: true,
        },
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create employee' });
    }
  }
}

async function importStockJournals(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      const item = findItem(ref, str(row.itemName));
      if (!item) throw new Error(`Item "${str(row.itemName)}" not found`);
      if (!item.inventory) throw new Error(`Item "${str(row.itemName)}" has no inventory record`);

      const qty = num(row.quantity);
      const typeStr = str(row.type).toUpperCase().replace(/[\s-]+/g, '_');
      if (typeStr !== 'ADJUSTMENT_IN' && typeStr !== 'ADJUSTMENT_OUT') {
        throw new Error(`Type must be ADJUSTMENT_IN or ADJUSTMENT_OUT`);
      }

      await transaction(async (tx) => {
        const journalNumber = await generateJournalNumber(tx as any);

        const journal = await tx.stockJournal.create({
          data: {
            journalNumber,
            date: parseDate(row.date),
            itemId: item.id,
            quantity: qty,
            type: typeStr as any,
            reason: str(row.reason) || null,
            createdBy: SYSTEM_USER_ID,
          },
        });

        const inventoryUpdate = typeStr === 'ADJUSTMENT_IN'
          ? { physicalStock: { increment: qty } }
          : { physicalStock: { decrement: qty } };

        await tx.inventory.update({
          where: { id: item.inventory!.id },
          data: inventoryUpdate,
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: item.inventory!.id,
            itemId: item.id,
            quantity: qty,
            type: typeStr as any,
            referenceType: 'STOCK_JOURNAL',
            referenceId: journal.id,
            notes: `Import - ${journalNumber}`,
          },
        });
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create stock journal' });
    }
  }
}

async function importPayments(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      const cust = findCustomer(ref, str(row.customerName));
      if (!cust) throw new Error(`Customer "${str(row.customerName)}" not found`);

      const modeStr = str(row.mode).toUpperCase().replace(/[\s-]+/g, '_');
      const amount = num(row.amount);
      const bankName = str(row.bankAccountName);
      const bank = bankName ? findBankAccount(ref, bankName) : null;

      await transaction(async (tx) => {
        const paymentNumber = await generatePaymentNumber(tx as any);

        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            paymentDate: parseDate(row.paymentDate),
            customerId: cust.id,
            amount,
            mode: modeStr as any,
            bankAccountId: bank?.id || null,
            referenceNumber: str(row.referenceNumber) || null,
            notes: str(row.notes) || null,
          },
        });

        // customer ledger entry
        const lastEntry = await tx.customerLedger.findFirst({
          where: { customerId: cust.id },
          orderBy: { date: 'desc' },
        });
        const _prevBalance = lastEntry ? Number(lastEntry.balance) : Number(cust.creditDays); // opening
        const newBalance = (lastEntry ? Number(lastEntry.balance) : 0) - amount;

        await tx.customerLedger.create({
          data: {
            customerId: cust.id,
            date: parseDate(row.paymentDate),
            description: `Payment ${paymentNumber}`,
            type: 'SALES_RECEIPT',
            debit: 0,
            credit: amount,
            balance: newBalance,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
          },
        });

        // bank ledger if bank account
        if (bank) {
          const lastBankEntry = await tx.bankLedger.findFirst({
            where: { bankAccountId: bank.id },
            orderBy: { date: 'desc' },
          });
          const bankBalance = (lastBankEntry ? Number(lastBankEntry.balance) : 0) + amount;

          await tx.bankLedger.create({
            data: {
              bankAccountId: bank.id,
              date: parseDate(row.paymentDate),
              description: `Payment received - ${paymentNumber}`,
              type: 'SALES_RECEIPT',
              debit: amount,
              credit: 0,
              balance: bankBalance,
              referenceType: 'PAYMENT',
              referenceId: payment.id,
            },
          });

          await tx.bankAccount.update({
            where: { id: bank.id },
            data: { currentBalance: { increment: amount } },
          });
        }
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create payment' });
    }
  }
}

async function importVendorPayments(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      const vend = findVendor(ref, str(row.vendorName));
      if (!vend) throw new Error(`Vendor "${str(row.vendorName)}" not found`);

      const modeStr = str(row.mode).toUpperCase().replace(/[\s-]+/g, '_');
      const amount = num(row.amount);
      const bankName = str(row.bankAccountName);
      const bank = bankName ? findBankAccount(ref, bankName) : null;

      await transaction(async (tx) => {
        const paymentNumber = await generateVendorPaymentNumber(tx as any);

        const payment = await tx.vendorPayment.create({
          data: {
            paymentNumber,
            date: parseDate(row.date),
            vendorId: vend.id,
            amount,
            mode: modeStr as any,
            paidFrom: str(row.paidFrom) || 'CASH',
            bankAccountId: bank?.id || null,
            reference: str(row.reference) || null,
            notes: str(row.notes) || null,
          },
        });

        // vendor ledger entry
        const lastEntry = await tx.vendorLedger.findFirst({
          where: { vendorId: vend.id },
          orderBy: { date: 'desc' },
        });
        const newBalance = (lastEntry ? Number(lastEntry.balance) : 0) - amount;

        await tx.vendorLedger.create({
          data: {
            vendorId: vend.id,
            date: parseDate(row.date),
            description: `Payment ${paymentNumber}`,
            type: 'PURCHASE_PAYMENT',
            debit: 0,
            credit: amount,
            balance: newBalance,
            referenceType: 'VENDOR_PAYMENT',
            referenceId: payment.id,
          },
        });

        if (bank) {
          const lastBankEntry = await tx.bankLedger.findFirst({
            where: { bankAccountId: bank.id },
            orderBy: { date: 'desc' },
          });
          const bankBalance = (lastBankEntry ? Number(lastBankEntry.balance) : 0) - amount;

          await tx.bankLedger.create({
            data: {
              bankAccountId: bank.id,
              date: parseDate(row.date),
              description: `Vendor payment - ${paymentNumber}`,
              type: 'PURCHASE_PAYMENT',
              debit: 0,
              credit: amount,
              balance: bankBalance,
              referenceType: 'VENDOR_PAYMENT',
              referenceId: payment.id,
            },
          });

          await tx.bankAccount.update({
            where: { id: bank.id },
            data: { currentBalance: { decrement: amount } },
          });
        }
      });
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: offset + i + 1, field: '', message: e.message || 'Failed to create vendor payment' });
    }
  }
}

async function importSalesInvoices(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  // Group rows by invoiceNumber
  const groups = new Map<string, { rows: Record<string, unknown>[]; indices: number[] }>();
  for (let i = 0; i < batch.length; i++) {
    const invNo = str(batch[i].invoiceNumber);
    if (!groups.has(invNo)) groups.set(invNo, { rows: [], indices: [] });
    groups.get(invNo)!.rows.push(batch[i]);
    groups.get(invNo)!.indices.push(offset + i + 1);
  }

  for (const [invNo, { rows: invRows, indices }] of groups) {
    try {
      const firstRow = invRows[0];

      // Check duplicate invoice number
      const existing = await db.invoice.findUnique({ where: { invoiceNumber: invNo } });
      if (existing) throw new Error(`Invoice ${invNo} already exists`);

      await transaction(async (tx) => {
        const custByName = findCustomer(ref, str(firstRow.customerName));
        const cust = custByName || (firstRow.customerGstin ? findCustomer(ref, str(firstRow.customerGstin)) : undefined);
        const isImported = !cust || invRows.some(r => !findItem(ref, str(r.itemCode) || str(r.itemName), str(r.hsnCode)));

        // Calculate line items
        const lineItems: { itemId: string | null; itemName: string; ref: string | null; quantity: number; rate: number; discountPercent: number; taxRate: number; taxAmount: number; amount: number; inventoryId: string | null }[] = [];
        let subtotal = 0;
        let totalTax = 0;

        for (const row of invRows) {
          const item = findItem(ref, str(row.itemCode) || str(row.itemName), str(row.hsnCode));
          const qty = num(row.quantity);
          const rate = num(row.rate);
          const disc = num(row.discountPercent);
          const lineAmount = qty * rate * (1 - disc / 100);
          const { taxRate, taxAmount } = calcLineTax(row, lineAmount, item);

          lineItems.push({
            itemId: item?.id || null,
            itemName: str(row.itemName) || str(row.itemCode),
            ref: str(row.ref) || (str(row.hsnCode) ? `HSN:${str(row.hsnCode)}` : null),
            quantity: qty,
            rate,
            discountPercent: disc,
            taxRate,
            taxAmount,
            amount: Math.round(lineAmount * 100) / 100,
            inventoryId: item?.inventory?.id || null,
          });

          subtotal += lineAmount;
          totalTax += taxAmount;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        totalTax = Math.round(totalTax * 100) / 100;
        const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
        const cgst = Math.round(totalTax / 2 * 100) / 100;
        const sgst = totalTax - cgst;

        const importDate = new Date();
        const invoice = await (tx.invoice.create as any)({
          data: {
            invoiceNumber: invNo,
            invoiceDate: firstRow.invoiceDate ? parseDate(firstRow.invoiceDate) : importDate,
            customerId: cust?.id || null,
            customerName: str(firstRow.customerName),
            subtotal,
            cgst,
            sgst,
            taxAmount: totalTax,
            totalAmount,
            balanceAmount: totalAmount,
            paymentStatus: 'PENDING',
            isImported,
            dueDate: firstRow.dueDate ? parseDate(firstRow.dueDate) : undefined,
            notes: str(firstRow.notes) || null,
            ref: str(firstRow.ref) || null,
          },
        });

        // Create invoice items (no stock movement yet)
        for (const li of lineItems) {
          await (tx.invoiceItem.create as any)({
            data: {
              invoiceId: invoice.id,
              itemId: li.itemId,
              itemName: li.itemName,
              ref: li.ref,
              quantity: li.quantity,
              rate: li.rate,
              discountPercent: li.discountPercent,
              taxRate: li.taxRate,
              taxAmount: li.taxAmount,
              amount: li.amount,
            },
          });
        }

        // Apply stock only if every item in the invoice is resolved
        const allResolved = lineItems.every(li => li.itemId && li.inventoryId);
        if (allResolved) {
          for (const li of lineItems) {
            await tx.inventory.update({
              where: { id: li.inventoryId! },
              data: { physicalStock: { decrement: li.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                inventoryId: li.inventoryId!,
                itemId: li.itemId!,
                quantity: li.quantity,
                type: 'SALE',
                referenceType: 'INVOICE',
                referenceId: invoice.id,
                notes: `Import - ${invNo}`,
              },
            });
          }
        }

        // Customer ledger (only if customer exists in masters)
        if (cust) {
          const lastEntry = await tx.customerLedger.findFirst({
            where: { customerId: cust.id },
            orderBy: { date: 'desc' },
          });
          const newBalance = (lastEntry ? Number(lastEntry.balance) : 0) + totalAmount;

          await tx.customerLedger.create({
            data: {
              customerId: cust.id,
              date: importDate,
              description: `Sales Invoice ${invNo}`,
              type: 'SALES_INVOICE',
              debit: totalAmount,
              credit: 0,
              balance: newBalance,
              referenceType: 'INVOICE',
              referenceId: invoice.id,
            },
          });
        }
      });

      result.success += invRows.length;
    } catch (e: any) {
      result.failed += invRows.length;
      for (const idx of indices) {
        result.errors.push({ row: idx, field: '', message: e.message || 'Failed to create invoice' });
      }
    }
  }
}

async function importPurchaseInvoices(batch: Record<string, unknown>[], offset: number, ref: RefData, result: ImportResult) {
  // Group rows by invoiceNumber
  const groups = new Map<string, { rows: Record<string, unknown>[]; indices: number[] }>();
  for (let i = 0; i < batch.length; i++) {
    const invNo = str(batch[i].invoiceNumber);
    if (!groups.has(invNo)) groups.set(invNo, { rows: [], indices: [] });
    groups.get(invNo)!.rows.push(batch[i]);
    groups.get(invNo)!.indices.push(offset + i + 1);
  }

  for (const [invNo, { rows: invRows, indices }] of groups) {
    try {
      const firstRow = invRows[0];

      const existing = await db.purchaseInvoice.findUnique({ where: { invoiceNumber: invNo } });
      if (existing) throw new Error(`Purchase Invoice ${invNo} already exists`);

      await transaction(async (tx) => {
        const vendByName = findVendor(ref, str(firstRow.vendorName));
        const vend = vendByName || (firstRow.vendorGstin ? findVendor(ref, str(firstRow.vendorGstin)) : undefined);
        const isImported = !vend || invRows.some(r => !findItem(ref, str(r.itemCode) || str(r.itemName), str(r.hsnCode)));

        const lineItems: { itemId: string | null; itemName: string; ref: string | null; quantity: number; rate: number; discountPercent: number; taxRate: number; taxAmount: number; amount: number; inventoryId: string | null }[] = [];
        let subtotal = 0;
        let totalTax = 0;

        for (const row of invRows) {
          const item = findItem(ref, str(row.itemCode) || str(row.itemName), str(row.hsnCode));
          const qty = num(row.quantity);
          const rate = num(row.rate);
          const disc = num(row.discountPercent);
          const lineAmount = qty * rate * (1 - disc / 100);
          const { taxRate, taxAmount } = calcLineTax(row, lineAmount, item);

          lineItems.push({
            itemId: item?.id || null,
            itemName: str(row.itemName) || str(row.itemCode),
            ref: str(row.ref) || (str(row.hsnCode) ? `HSN:${str(row.hsnCode)}` : null),
            quantity: qty,
            rate,
            discountPercent: disc,
            taxRate,
            taxAmount,
            amount: Math.round(lineAmount * 100) / 100,
            inventoryId: item?.inventory?.id || null,
          });

          subtotal += lineAmount;
          totalTax += taxAmount;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        totalTax = Math.round(totalTax * 100) / 100;
        const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

        const importDate = new Date();
        const invoice = await (tx.purchaseInvoice.create as any)({
          data: {
            invoiceNumber: invNo,
            vendorId: vend?.id || null,
            vendorName: vend?.name || str(firstRow.vendorName),
            date: firstRow.date ? parseDate(firstRow.date) : importDate,
            dueDate: parseDate(firstRow.dueDate),
            amount: subtotal,
            taxAmount: totalTax,
            totalAmount,
            balanceAmount: totalAmount,
            status: 'PENDING',
            isImported,
            notes: str(firstRow.notes) || null,
            ref: str(firstRow.ref) || null,
          },
        });

        // Create purchase invoice items (no stock movement yet)
        for (const li of lineItems) {
          await (tx.purchaseInvoiceItem.create as any)({
            data: {
              purchaseInvoiceId: invoice.id,
              itemId: li.itemId,
              itemName: li.itemName,
              ref: li.ref,
              quantity: li.quantity,
              rate: li.rate,
              discountPercent: li.discountPercent,
              taxRate: li.taxRate,
              taxAmount: li.taxAmount,
              amount: li.amount,
            },
          });
        }

        // Apply stock only if every item in the invoice is resolved
        const allResolved = lineItems.every(li => li.itemId && li.inventoryId);
        if (allResolved) {
          for (const li of lineItems) {
            await tx.inventory.update({
              where: { id: li.inventoryId! },
              data: { physicalStock: { increment: li.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                inventoryId: li.inventoryId!,
                itemId: li.itemId!,
                quantity: li.quantity,
                type: 'PURCHASE',
                referenceType: 'PURCHASE_INVOICE',
                referenceId: invoice.id,
                notes: `Import - ${invNo}`,
              },
            });
          }
        }

        // Vendor ledger (only if vendor exists in masters)
        if (vend) {
          const lastEntry = await tx.vendorLedger.findFirst({
            where: { vendorId: vend.id },
            orderBy: { date: 'desc' },
          });
          const newBalance = (lastEntry ? Number(lastEntry.balance) : 0) + totalAmount;

          await tx.vendorLedger.create({
            data: {
              vendorId: vend.id,
              date: importDate,
              description: `Purchase Invoice ${invNo}`,
              type: 'PURCHASE_INVOICE',
              debit: totalAmount,
              credit: 0,
              balance: newBalance,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: invoice.id,
            },
          });
        }
      });

      result.success += invRows.length;
    } catch (e: any) {
      result.failed += invRows.length;
      for (const idx of indices) {
        result.errors.push({ row: idx, field: '', message: e.message || 'Failed to create purchase invoice' });
      }
    }
  }
}

// ── main handler ─────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { action, entityType, rows } = body;

    if (!action || !entityType || !rows) {
      return NextResponse.json({ error: 'action, entityType, and rows are required' }, { status: 400 });
    }

    if (!ENTITY_FIELDS[entityType as EntityType]) {
      return NextResponse.json({ error: `Invalid entity type: ${entityType}` }, { status: 400 });
    }

    if (action === 'validate') {
      const results = await validateRows(entityType as EntityType, rows);
      return NextResponse.json({ results });
    }

    if (action === 'import') {
      const results = await importRows(entityType as EntityType, rows);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: 'action must be "validate" or "import"' }, { status: 400 });
  } catch (error: any) {
    console.error('Import execute error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
