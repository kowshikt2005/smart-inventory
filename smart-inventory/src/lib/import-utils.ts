export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'decimal' | 'date' | 'boolean' | 'enum' | 'fk';
  enumValues?: string[];
  fkEntity?: string;
  fkMatchField?: string;
  maxLength?: number;
  aliases?: string[]; // extra column-name aliases for auto-mapping
  unit?: '%' | '₹';   // shown as a badge in the mapping table
}

export type EntityType =
  | 'CUSTOMER'
  | 'VENDOR'
  | 'ITEM'
  | 'EMPLOYEE'
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
    { key: 'brandName', label: 'Brand Name', required: true, type: 'fk', fkEntity: 'brand', fkMatchField: 'name', aliases: ['catbrand', 'brand', 'companyname', 'manufacturer'] },
    { key: 'subBrandName', label: 'Sub-Brand Name', required: false, type: 'fk', fkEntity: 'subBrand', fkMatchField: 'name', aliases: ['category', 'cat', 'subcategory', 'subbrand', 'productline', 'segment'] },
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
    { key: 'invoiceNumber', label: 'Invoice Number', required: true, type: 'string', aliases: ['invno', 'invoiceno', 'billno', 'billnumber', 'saprefno', 'sapreferenceno', 'voucherno', 'docno', 'documentno', 'gstinvoiceno', 'receiptno'] },
    { key: 'invoiceDate', label: 'Invoice Date', required: true, type: 'date', aliases: ['invoicedt', 'billdate', 'billdt', 'date', 'dt', 'invdate', 'invdt'] },
    { key: 'customerName', label: 'Customer Name', required: true, type: 'fk', fkEntity: 'customer', fkMatchField: 'name', aliases: ['customername', 'partyname', 'buyername', 'buyer', 'customer', 'billto', 'soldto', 'consignee'] },
    { key: 'customerGstin', label: 'Customer GSTIN', required: false, type: 'string', maxLength: 15, aliases: ['gstin', 'gstno', 'gstinno', 'buyergstin'] },
    { key: 'dueDate', label: 'Due Date', required: false, type: 'date', aliases: ['duedt', 'paymentdue', 'paymentdate'] },
    { key: 'itemName', label: 'Item Name', required: true, type: 'fk', fkEntity: 'item', fkMatchField: 'name', aliases: ['item', 'description', 'desc', 'particulars', 'product', 'productname', 'material', 'materialdesc', 'materialdescription', 'goodsdescription', 'packdesc', 'varpackdesc', 'variantpackdesc', 'itemdescription', 'itemdesc', 'nameofproduct', 'nameofgoods'] },
    { key: 'itemCode', label: 'Item Code', required: false, type: 'string', aliases: ['packcode', 'productcode', 'materialcode', 'sku', 'code', 'partno', 'partnumber', 'cat', 'skucode', 'itemno', 'srno'] },
    { key: 'hsnCode', label: 'HSN Code', required: false, type: 'string', maxLength: 8, aliases: ['hsn', 'hsnsac', 'saccode', 'hsncode', 'hsnsaccode'] },
    { key: 'batchNo', label: 'Batch No', required: false, type: 'string', aliases: ['batch', 'batchnumber', 'batchno', 'lotno', 'lotnumber', 'batchid'] },
    { key: 'mrp', label: 'MRP', required: false, type: 'decimal', aliases: ['mrppack', 'mrpunit', 'mrpperpack', 'maximumretailprice', 'mrpperunit', 'mrprs'] },
    { key: 'quantity', label: 'Quantity', required: true, type: 'decimal', aliases: ['qty', 'qtyinunits', 'qtyin', 'noofunits', 'units', 'pcs', 'nos', 'pieces', 'qtyunits', 'quantityinunits', 'noofpkt', 'noofpktunits', 'totalqty', 'orderqty', 'despatchqty', 'dispatchqty', 'deliveredqty'] },
    { key: 'unit', label: 'Unit', required: false, type: 'string', aliases: ['uom', 'unitofmeasure', 'unitofmeasurement'] },
    { key: 'rate', label: 'Rate', required: true, type: 'decimal', aliases: ['rateunit', 'rateperunit', 'price', 'unitprice', 'unitrate', 'priceunit', 'priceperunit', 'ratepers', 'basicrate'] },
    { key: 'baseValue', label: 'Base Value', required: false, type: 'decimal', unit: '₹', aliases: ['basevalue', 'basicvalue', 'basicamount', 'assessablevalue', 'baseamount'] },
    { key: 'discountPercent', label: 'Discount %', required: false, type: 'decimal', aliases: ['disc', 'discpercent', 'discountpercent', 'discper'] },
    { key: 'discountAmount', label: 'Discount Amount', required: false, type: 'decimal', unit: '₹', aliases: ['discntrs', 'discountrs', 'discamt', 'discountamount', 'discountvalue', 'discount', 'discrs', 'discntamount'] },
    { key: 'taxableValue', label: 'Taxable Value', required: false, type: 'decimal', unit: '₹', aliases: ['taxableamt', 'taxableamount', 'taxableto', 'taxabletotal', 'taxablevalue', 'assessablevalue'] },
    { key: 'taxRate', label: 'Tax Rate %', required: false, type: 'decimal', unit: '%', aliases: ['gstpercent', 'gstrate', 'taxratepercent', 'gstdisc'] },
    { key: 'cgstRate', label: 'CGST %', required: false, type: 'decimal', unit: '%', aliases: ['cgstpercent', 'cgstrate', 'cgstratepercent'] },
    { key: 'sgstRate', label: 'SGST %', required: false, type: 'decimal', unit: '%', aliases: ['sgstpercent', 'sgstrate', 'sgstratepercent'] },
    { key: 'taxAmount', label: 'Tax Amount', required: false, type: 'decimal', unit: '₹', aliases: ['totaltax', 'gstamount', 'gstvalue', 'taxvalue', 'totaltaxamount', 'totalgst'] },
    { key: 'cgstAmount', label: 'CGST Amount', required: false, type: 'decimal', unit: '₹', aliases: ['cgstvalue', 'cgstamt', 'cgstrs', 'cgstamtrs'] },
    { key: 'sgstAmount', label: 'SGST Amount', required: false, type: 'decimal', unit: '₹', aliases: ['sgstvalue', 'sgstamt', 'sgstrs', 'sgstamtrs'] },
    { key: 'grossValue', label: 'Gross Value', required: false, type: 'decimal', unit: '₹', aliases: ['grossamount', 'totalamount', 'total', 'netamount', 'invoiceamount', 'grandtotal', 'netvalue', 'grossvalue', 'invoicevalue'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['remarks', 'comment', 'comments', 'narration'] },
    { key: 'ref', label: 'Ref / Source', required: false, type: 'string', aliases: ['reference', 'referenceno', 'refno', 'source', 'orderno', 'orderref', 'pono', 'purchaseorderno'] },
  ],
  PURCHASE_INVOICE: [
    { key: 'invoiceNumber', label: 'Invoice Number', required: true, type: 'string', aliases: ['invno', 'invoiceno', 'billno', 'billnumber', 'saprefno', 'sapreferenceno', 'voucherno', 'docno', 'documentno', 'gstinvoiceno', 'receiptno'] },
    { key: 'date', label: 'Date', required: true, type: 'date', aliases: ['invoicedate', 'invoicedt', 'billdate', 'billdt', 'dt', 'invdate', 'invdt'] },
    { key: 'dueDate', label: 'Due Date', required: false, type: 'date', aliases: ['duedt', 'paymentdue', 'paymentdate'] },
    { key: 'vendorName', label: 'Vendor Name', required: true, type: 'fk', fkEntity: 'vendor', fkMatchField: 'name', aliases: ['vendorname', 'partyname', 'suppliername', 'supplier', 'from', 'vendor', 'sellerName', 'seller', 'despatchedfrom', 'stockdespatchedfrom'] },
    { key: 'vendorGstin', label: 'Vendor GSTIN', required: false, type: 'string', maxLength: 15, aliases: ['gstin', 'gstno', 'gstinno', 'sellergstin', 'suppliergstin'] },
    { key: 'itemName', label: 'Item Name', required: true, type: 'fk', fkEntity: 'item', fkMatchField: 'name', aliases: ['item', 'description', 'desc', 'particulars', 'product', 'productname', 'material', 'materialdesc', 'materialdescription', 'goodsdescription', 'packdesc', 'varpackdesc', 'variantpackdesc', 'itemdescription', 'itemdesc', 'nameofproduct', 'nameofgoods'] },
    { key: 'itemCode', label: 'Item Code', required: false, type: 'string', aliases: ['packcode', 'productcode', 'materialcode', 'sku', 'code', 'partno', 'partnumber', 'cat', 'skucode', 'itemno', 'srno'] },
    { key: 'hsnCode', label: 'HSN Code', required: false, type: 'string', maxLength: 8, aliases: ['hsn', 'hsnsac', 'saccode', 'hsncode', 'hsnsaccode'] },
    { key: 'batchNo', label: 'Batch No', required: false, type: 'string', aliases: ['batch', 'batchnumber', 'batchno', 'lotno', 'lotnumber', 'batchid'] },
    { key: 'mrp', label: 'MRP', required: false, type: 'decimal', aliases: ['mrppack', 'mrpunit', 'mrpperpack', 'maximumretailprice', 'mrpperunit', 'mrprs'] },
    { key: 'quantity', label: 'Quantity', required: true, type: 'decimal', aliases: ['qty', 'qtyinunits', 'qtyin', 'noofunits', 'units', 'pcs', 'nos', 'pieces', 'qtyunits', 'quantityinunits', 'noofpkt', 'noofpktunits', 'totalqty', 'orderqty', 'despatchqty', 'dispatchqty', 'deliveredqty'] },
    { key: 'unit', label: 'Unit', required: false, type: 'string', aliases: ['uom', 'unitofmeasure', 'unitofmeasurement'] },
    { key: 'rate', label: 'Rate', required: true, type: 'decimal', aliases: ['rateunit', 'rateperunit', 'price', 'unitprice', 'unitrate', 'priceunit', 'priceperunit', 'ratepers', 'basicrate'] },
    { key: 'baseValue', label: 'Base Value', required: false, type: 'decimal', unit: '₹', aliases: ['basevalue', 'basicvalue', 'basicamount', 'assessablevalue', 'baseamount'] },
    { key: 'discountPercent', label: 'Discount %', required: false, type: 'decimal', aliases: ['disc', 'discpercent', 'discountpercent', 'discper'] },
    { key: 'discountAmount', label: 'Discount Amount', required: false, type: 'decimal', unit: '₹', aliases: ['discntrs', 'discountrs', 'discamt', 'discountamount', 'discountvalue', 'discount', 'discrs', 'discntamount'] },
    { key: 'taxableValue', label: 'Taxable Value', required: false, type: 'decimal', unit: '₹', aliases: ['taxableamt', 'taxableamount', 'taxableto', 'taxabletotal', 'taxablevalue', 'assessablevalue'] },
    { key: 'taxRate', label: 'Tax Rate %', required: false, type: 'decimal', unit: '%', aliases: ['gstpercent', 'gstrate', 'taxratepercent', 'gstdisc'] },
    { key: 'cgstRate', label: 'CGST %', required: false, type: 'decimal', unit: '%', aliases: ['cgstpercent', 'cgstrate', 'cgstratepercent'] },
    { key: 'sgstRate', label: 'SGST %', required: false, type: 'decimal', unit: '%', aliases: ['sgstpercent', 'sgstrate', 'sgstratepercent'] },
    { key: 'taxAmount', label: 'Tax Amount', required: false, type: 'decimal', unit: '₹', aliases: ['totaltax', 'gstamount', 'gstvalue', 'taxvalue', 'totaltaxamount', 'totalgst'] },
    { key: 'cgstAmount', label: 'CGST Amount', required: false, type: 'decimal', unit: '₹', aliases: ['cgstvalue', 'cgstamt', 'cgstrs', 'cgstamtrs'] },
    { key: 'sgstAmount', label: 'SGST Amount', required: false, type: 'decimal', unit: '₹', aliases: ['sgstvalue', 'sgstamt', 'sgstrs', 'sgstamtrs'] },
    { key: 'grossValue', label: 'Gross Value', required: false, type: 'decimal', unit: '₹', aliases: ['grossamount', 'totalamount', 'total', 'netamount', 'invoiceamount', 'grandtotal', 'netvalue', 'grossvalue', 'invoicevalue'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['remarks', 'comment', 'comments', 'narration'] },
    { key: 'ref', label: 'Ref / Source', required: false, type: 'string', aliases: ['reference', 'referenceno', 'refno', 'source', 'orderno', 'orderref', 'pono', 'purchaseorderno'] },
  ],
  EMPLOYEE: [
    { key: 'name', label: 'Name', required: true, type: 'string', maxLength: 255 },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'designation', label: 'Designation', required: false, type: 'string' },
    { key: 'department', label: 'Department', required: false, type: 'string' },
    { key: 'salary', label: 'Salary', required: false, type: 'decimal' },
    { key: 'joinDate', label: 'Join Date', required: true, type: 'date' },
  ],
};

export interface RowValidation {
  rowIndex: number;
  status: 'valid' | 'error' | 'warning';
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  resolvedData: Record<string, unknown>;
}

// Normalize a string for comparison: lowercase, strip all non-alphanumeric
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Split a header like "Var / Pack Desc." into individual words for word-level matching
function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
}

/**
 * Auto-match entity fields to Excel column headers using multi-strategy matching.
 * Returns { dbField: excelColumn } — i.e. for each system field, which Excel column best matches.
 *
 * Matching priority:
 * 1. Exact match on normalized label, key, or alias
 * 2. Substring match (header contains field name or vice versa)
 * 3. Word-level match (any word in the header matches a key/alias word)
 */
export function autoMatchColumns(
  headers: string[],
  entityType: EntityType
): Record<string, string> {
  const fields = ENTITY_FIELDS[entityType];
  const mapping: Record<string, string> = {};
  // Track which headers are already claimed to avoid double-mapping
  const claimed = new Set<string>();

  // Pass 1: exact matches (highest confidence)
  for (const field of fields) {
    const fieldNorm = norm(field.label);
    const keyNorm = norm(field.key);
    const aliasNorms = (field.aliases || []).map(a => norm(a));

    for (const header of headers) {
      if (claimed.has(header)) continue;
      const headerNorm = norm(header);
      if (headerNorm === fieldNorm || headerNorm === keyNorm || aliasNorms.includes(headerNorm)) {
        mapping[field.key] = header;
        claimed.add(header);
        break;
      }
    }
  }

  // Pass 2: substring match (field label/key/alias is contained in header or vice versa)
  for (const field of fields) {
    if (mapping[field.key]) continue;
    const fieldNorm = norm(field.label);
    const keyNorm = norm(field.key);
    const aliasNorms = (field.aliases || []).map(a => norm(a));
    const allTerms = [fieldNorm, keyNorm, ...aliasNorms].filter(t => t.length >= 3);

    for (const header of headers) {
      if (claimed.has(header)) continue;
      const headerNorm = norm(header);
      const matched = allTerms.some(term =>
        headerNorm.includes(term) || term.includes(headerNorm)
      );
      if (matched) {
        mapping[field.key] = header;
        claimed.add(header);
        break;
      }
    }
  }

  // Pass 3: word-level match — split header into words and check if any
  // significant word matches a key/alias. Handles cases like
  // "Qty in Units" matching "qty" alias, "Var / Pack Desc." matching "desc" alias.
  for (const field of fields) {
    if (mapping[field.key]) continue;
    const keyNorm = norm(field.key);
    const aliasNorms = (field.aliases || []).map(a => norm(a));
    // Only use words that are meaningful enough (>=3 chars) to avoid false positives
    const matchTerms = new Set([keyNorm, ...aliasNorms].filter(t => t.length >= 3));

    for (const header of headers) {
      if (claimed.has(header)) continue;
      const headerWords = words(header);
      // Check if any header word matches, or if the concatenated header words form a match
      const wordMatch = headerWords.some(w => w.length >= 3 && matchTerms.has(w));
      // Also check concatenation of adjacent words: "pack desc" → "packdesc"
      const concats: string[] = [];
      for (let i = 0; i < headerWords.length - 1; i++) {
        concats.push(headerWords[i] + headerWords[i + 1]);
      }
      const concatMatch = concats.some(c => matchTerms.has(c));

      if (wordMatch || concatMatch) {
        mapping[field.key] = header;
        claimed.add(header);
        break;
      }
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

  // mapping is { dbField: excelColumn }
  const mapped: Record<string, unknown> = {};
  for (const [dbField, excelCol] of Object.entries(mapping)) {
    if (excelCol) mapped[dbField] = row[excelCol];
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

    if ((field.type === 'number' || field.type === 'decimal') && field.required) {
      const firstToken = strVal.replace(/,/g, '').trim().split(/\s+/)[0];
      if (isNaN(Number(firstToken))) {
        errors.push({ field: field.key, message: `${field.label} must be a valid number` });
      }
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
 * mapping is { dbField: excelColumn }
 */
export function applyMapping(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [dbField, excelCol] of Object.entries(mapping)) {
      if (excelCol) {
        mapped[dbField] = row[excelCol];
      }
    }
    return mapped;
  });
}
