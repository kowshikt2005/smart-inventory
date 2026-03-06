export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'decimal' | 'date' | 'boolean' | 'enum' | 'fk';
  enumValues?: string[];
  fkEntity?: string;
  fkMatchField?: string;
  maxLength?: number;
}

export type EntityType =
  | 'CUSTOMER'
  | 'VENDOR'
  | 'ITEM'
  | 'STOCK_JOURNAL'
  | 'PAYMENT'
  | 'VENDOR_PAYMENT'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE';

export const ENTITY_FIELDS: Record<EntityType, ImportField[]> = {
  CUSTOMER: [
    { key: 'name', label: 'Name', required: true, type: 'string', maxLength: 255 },
    { key: 'gstin', label: 'GSTIN', required: false, type: 'string', maxLength: 15 },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'address', label: 'Address', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'state', label: 'State', required: false, type: 'string' },
    { key: 'pincode', label: 'Pincode', required: false, type: 'string' },
    { key: 'openingBalance', label: 'Opening Balance', required: false, type: 'decimal' },
    { key: 'creditLimit', label: 'Credit Limit', required: false, type: 'decimal' },
    { key: 'creditDays', label: 'Credit Days', required: false, type: 'number' },
  ],
  VENDOR: [
    { key: 'name', label: 'Name', required: true, type: 'string', maxLength: 255 },
    { key: 'gstin', label: 'GSTIN', required: false, type: 'string', maxLength: 15 },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'address', label: 'Address', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'state', label: 'State', required: false, type: 'string' },
    { key: 'pincode', label: 'Pincode', required: false, type: 'string' },
    { key: 'openingBalance', label: 'Opening Balance', required: false, type: 'decimal' },
    { key: 'creditDays', label: 'Credit Days', required: false, type: 'number' },
  ],
  ITEM: [
    { key: 'name', label: 'Item Name', required: true, type: 'string', maxLength: 255 },
    { key: 'brandName', label: 'Brand Name', required: true, type: 'fk', fkEntity: 'brand', fkMatchField: 'name' },
    { key: 'subBrandName', label: 'Sub-Brand Name', required: true, type: 'fk', fkEntity: 'subBrand', fkMatchField: 'name' },
    { key: 'userCode', label: 'User Code', required: false, type: 'string' },
    { key: 'hsnCode', label: 'HSN Code', required: false, type: 'string', maxLength: 8 },
    { key: 'gstRate', label: 'GST Rate (%)', required: false, type: 'decimal' },
    { key: 'purchasePrice', label: 'Purchase Price', required: false, type: 'decimal' },
    { key: 'mrp', label: 'MRP', required: false, type: 'decimal' },
    { key: 'sellingPrice', label: 'Selling Price', required: false, type: 'decimal' },
    { key: 'unit', label: 'Unit', required: false, type: 'string' },
    { key: 'minStock', label: 'Min Stock', required: false, type: 'decimal' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
  ],
  STOCK_JOURNAL: [
    { key: 'itemName', label: 'Item Name', required: true, type: 'fk', fkEntity: 'item', fkMatchField: 'name' },
    { key: 'date', label: 'Date', required: true, type: 'date' },
    { key: 'quantity', label: 'Quantity', required: true, type: 'decimal' },
    { key: 'type', label: 'Type', required: true, type: 'enum', enumValues: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] },
    { key: 'reason', label: 'Reason', required: false, type: 'string' },
  ],
  PAYMENT: [
    { key: 'customerName', label: 'Customer Name', required: true, type: 'fk', fkEntity: 'customer', fkMatchField: 'name' },
    { key: 'paymentDate', label: 'Payment Date', required: true, type: 'date' },
    { key: 'amount', label: 'Amount', required: true, type: 'decimal' },
    { key: 'mode', label: 'Payment Mode', required: true, type: 'enum', enumValues: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] },
    { key: 'bankAccountName', label: 'Bank Account', required: false, type: 'fk', fkEntity: 'bankAccount', fkMatchField: 'accountName' },
    { key: 'referenceNumber', label: 'Reference Number', required: false, type: 'string' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
  ],
  VENDOR_PAYMENT: [
    { key: 'vendorName', label: 'Vendor Name', required: true, type: 'fk', fkEntity: 'vendor', fkMatchField: 'name' },
    { key: 'date', label: 'Date', required: true, type: 'date' },
    { key: 'amount', label: 'Amount', required: true, type: 'decimal' },
    { key: 'mode', label: 'Payment Mode', required: true, type: 'enum', enumValues: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] },
    { key: 'paidFrom', label: 'Paid From', required: true, type: 'string' },
    { key: 'bankAccountName', label: 'Bank Account', required: false, type: 'fk', fkEntity: 'bankAccount', fkMatchField: 'accountName' },
    { key: 'reference', label: 'Reference', required: false, type: 'string' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
  ],
  SALES_INVOICE: [
    { key: 'invoiceNumber', label: 'Invoice Number', required: true, type: 'string' },
    { key: 'invoiceDate', label: 'Invoice Date', required: true, type: 'date' },
    { key: 'customerName', label: 'Customer Name', required: true, type: 'fk', fkEntity: 'customer', fkMatchField: 'name' },
    { key: 'dueDate', label: 'Due Date', required: false, type: 'date' },
    { key: 'itemName', label: 'Item Name', required: true, type: 'fk', fkEntity: 'item', fkMatchField: 'name' },
    { key: 'quantity', label: 'Quantity', required: true, type: 'decimal' },
    { key: 'rate', label: 'Rate', required: true, type: 'decimal' },
    { key: 'discountPercent', label: 'Discount %', required: false, type: 'decimal' },
    { key: 'taxRate', label: 'Tax Rate %', required: false, type: 'decimal' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
    { key: 'ref', label: 'Ref / Source', required: false, type: 'string' },
  ],
  PURCHASE_INVOICE: [
    { key: 'invoiceNumber', label: 'Invoice Number', required: true, type: 'string' },
    { key: 'date', label: 'Date', required: true, type: 'date' },
    { key: 'dueDate', label: 'Due Date', required: true, type: 'date' },
    { key: 'vendorName', label: 'Vendor Name', required: true, type: 'fk', fkEntity: 'vendor', fkMatchField: 'name' },
    { key: 'itemName', label: 'Item Name', required: true, type: 'fk', fkEntity: 'item', fkMatchField: 'name' },
    { key: 'quantity', label: 'Quantity', required: true, type: 'decimal' },
    { key: 'rate', label: 'Rate', required: true, type: 'decimal' },
    { key: 'taxRate', label: 'Tax Rate %', required: false, type: 'decimal' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
    { key: 'ref', label: 'Ref / Source', required: false, type: 'string' },
  ],
};

export interface RowValidation {
  rowIndex: number;
  status: 'valid' | 'error' | 'warning';
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  resolvedData: Record<string, unknown>;
}

/**
 * Auto-match Excel column headers to entity fields using case-insensitive label matching.
 */
export function autoMatchColumns(
  headers: string[],
  entityType: EntityType
): Record<string, string> {
  const fields = ENTITY_FIELDS[entityType];
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalised = header.trim().toLowerCase().replace(/[_\-.\s]+/g, '');
    let bestMatch: string | null = null;

    for (const field of fields) {
      const fieldLabel = field.label.toLowerCase().replace(/[_\-.\s]+/g, '');
      const fieldKey = field.key.toLowerCase().replace(/[_\-.\s]+/g, '');

      if (normalised === fieldLabel || normalised === fieldKey) {
        bestMatch = field.key;
        break;
      }
      // partial match — header contains the label or vice versa
      if (!bestMatch && (normalised.includes(fieldLabel) || fieldLabel.includes(normalised))) {
        bestMatch = field.key;
      }
    }

    if (bestMatch) {
      mapping[header] = bestMatch;
    }
  }

  return mapping;
}

/**
 * Validate a single mapped row against field definitions.
 * Returns field-level errors / warnings. FK resolution happens server-side.
 */
export function validateRow(
  row: Record<string, unknown>,
  entityType: EntityType,
  mapping: Record<string, string>
): { errors: { field: string; message: string }[]; warnings: { field: string; message: string }[] } {
  const fields = ENTITY_FIELDS[entityType];
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];

  // Build a mapped-values object keyed by DB field
  const mapped: Record<string, unknown> = {};
  for (const [excelCol, dbField] of Object.entries(mapping)) {
    if (dbField) mapped[dbField] = row[excelCol];
  }

  for (const field of fields) {
    const value = mapped[field.key];
    const isEmpty = value === undefined || value === null || String(value).trim() === '';

    if (field.required && isEmpty) {
      errors.push({ field: field.key, message: `${field.label} is required` });
      continue;
    }

    if (isEmpty) continue;

    const strVal = String(value).trim();

    if (field.maxLength && strVal.length > field.maxLength) {
      errors.push({ field: field.key, message: `${field.label} must be at most ${field.maxLength} characters` });
    }

    if ((field.type === 'number' || field.type === 'decimal') && isNaN(Number(strVal))) {
      errors.push({ field: field.key, message: `${field.label} must be a valid number` });
    }

    if (field.type === 'date') {
      const d = new Date(strVal);
      if (isNaN(d.getTime())) {
        errors.push({ field: field.key, message: `${field.label} must be a valid date` });
      }
    }

    if (field.type === 'enum' && field.enumValues) {
      const upper = strVal.toUpperCase().replace(/[\s-]+/g, '_');
      if (!field.enumValues.includes(upper)) {
        errors.push({ field: field.key, message: `${field.label} must be one of: ${field.enumValues.join(', ')}` });
      }
    }

    if (field.key === 'gstin' && strVal && strVal.length !== 15) {
      warnings.push({ field: field.key, message: 'GSTIN should be 15 characters' });
    }
  }

  return { errors, warnings };
}

/**
 * Transform raw Excel rows using the column mapping into DB-field-keyed objects.
 */
export function applyMapping(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [excelCol, dbField] of Object.entries(mapping)) {
      if (dbField) {
        mapped[dbField] = row[excelCol];
      }
    }
    return mapped;
  });
}
