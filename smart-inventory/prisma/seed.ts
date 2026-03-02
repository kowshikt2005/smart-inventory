import { PrismaClient, Prisma } from '../src/generated/prisma';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.$transaction([
    prisma.bankLedger.deleteMany(),
    prisma.paymentAllocation.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.vendorPayment.deleteMany(),
    prisma.salesReturnItem.deleteMany(),
    prisma.salesReturn.deleteMany(),
    prisma.purchaseReturnItem.deleteMany(),
    prisma.purchaseReturn.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.purchaseInvoiceItem.deleteMany(),
    prisma.purchaseInvoice.deleteMany(),
    prisma.salesOrderItem.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.stockJournal.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.item.deleteMany(),
    prisma.subBrand.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.rateSheetCustomer.deleteMany(),
    prisma.rateSheet.deleteMany(),
    prisma.customerLedger.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.vendorLedger.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.bankAccount.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
  ]);

  // 1. Create App Settings
  console.log('⚙️  Creating app settings...');
  await prisma.appSetting.create({
    data: {
      key: 'negative_billing',
      value: 'false',
      label: 'Negative Billing',
    },
  });

  // 2. Create Roles
  console.log('🔐 Creating roles...');
  type PagePerm = { view: boolean; edit: boolean };
  type Perms = Record<string, PagePerm>;
  const none: PagePerm = { view: false, edit: false };
  const viewOnly: PagePerm = { view: true, edit: false };
  const full: PagePerm = { view: true, edit: true };

  function buildPermissions(overrides: Record<string, PagePerm>): Perms {
    const allKeys = [
      'dashboard',
      'sales_orders', 'sales_invoices', 'sales_dummy_invoices', 'sales_receipts', 'sales_returns',
      'purchases_orders', 'purchases_reorders', 'purchases_invoices', 'purchases_payments', 'purchases_returns',
      'bank_accounts', 'bank_ledger',
      'ledger_customers', 'ledger_vendors', 'ledger_stock', 'ledger_stock_journal',
      'reports',
      'masters_customers', 'masters_vendors', 'masters_employees', 'masters_rate_sheets', 'masters_items', 'masters_roles',
      'settings',
    ];
    const perms: Perms = {};
    for (const key of allKeys) {
      perms[key] = overrides[key] ?? none;
    }
    return perms;
  }

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Full system access — all permissions',
      isSystem: true,
      isActive: true,
      permissions: buildPermissions({
        dashboard: full,
        sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
        purchases_orders: full, purchases_reorders: full, purchases_invoices: full, purchases_payments: full, purchases_returns: full,
        bank_accounts: full, bank_ledger: full,
        ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
        reports: full,
        masters_customers: full, masters_vendors: full, masters_employees: full, masters_rate_sheets: full, masters_items: full, masters_roles: full,
        settings: full,
      }),
    },
  });

  const salesmanRole = await prisma.role.create({
    data: {
      name: 'SALESMAN',
      description: 'Sales orders only',
      isSystem: true,
      isActive: true,
      permissions: buildPermissions({
        dashboard: viewOnly,
        sales_orders: full, sales_invoices: viewOnly,
      }),
    },
  });

  await prisma.role.createMany({
    data: [
      {
        name: 'MANAGER',
        description: 'All access except role management',
        isSystem: true,
        isActive: true,
        permissions: buildPermissions({
          dashboard: full,
          sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
          purchases_orders: full, purchases_reorders: full, purchases_invoices: full, purchases_payments: full, purchases_returns: full,
          bank_accounts: full, bank_ledger: full,
          ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
          reports: full,
          masters_customers: full, masters_vendors: full, masters_employees: viewOnly, masters_rate_sheets: full, masters_items: full,
          settings: full,
        }),
      },
      {
        name: 'ACCOUNTANT',
        description: 'Sales, ledger, reports, and read-only masters',
        isSystem: true,
        isActive: true,
        permissions: buildPermissions({
          dashboard: viewOnly,
          sales_orders: viewOnly, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
          bank_accounts: full, bank_ledger: full,
          ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
          reports: full,
          masters_customers: viewOnly, masters_vendors: viewOnly, masters_rate_sheets: viewOnly, masters_items: viewOnly,
        }),
      },
      {
        name: 'BILLING_OPERATOR',
        description: 'Sales transactions and basic reporting',
        isSystem: true,
        isActive: true,
        permissions: buildPermissions({
          dashboard: viewOnly,
          sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
          bank_accounts: viewOnly, bank_ledger: viewOnly,
          ledger_customers: viewOnly, ledger_vendors: viewOnly, ledger_stock: viewOnly, ledger_stock_journal: viewOnly,
          reports: viewOnly,
        }),
      },
    ],
  });

  // 3. Create Users
  console.log('👥 Creating users...');
  const hashedPassword = await hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      phone: '+918639347263',
      role: 'ADMIN',
      roleId: adminRole.id,
    },
  });

  const salesman = await prisma.user.create({
    data: {
      email: 'salesman@example.com',
      name: 'John Sales',
      password: hashedPassword,
      phone: '+919030437915',
      role: 'SALESMAN',
      roleId: salesmanRole.id,
    },
  });

  // 3. Create Brands and SubBrands
  console.log('🏷️  Creating brands and sub-brands...');
  const samsungBrand = await prisma.brand.create({
    data: {
      name: 'Samsung',
      discountPercent: 5,
      subBrands: {
        create: [
          { name: 'Galaxy S Series', discountPercent: 3 },
          { name: 'Galaxy A Series', discountPercent: 5 },
          { name: 'Galaxy M Series', discountPercent: 7 },
        ],
      },
    },
    include: { subBrands: true },
  });

  const appleBrand = await prisma.brand.create({
    data: {
      name: 'Apple',
      discountPercent: 2,
      subBrands: {
        create: [
          { name: 'iPhone', discountPercent: 1 },
          { name: 'iPad', discountPercent: 2 },
          { name: 'MacBook', discountPercent: 1.5 },
        ],
      },
    },
    include: { subBrands: true },
  });

  const lenovoBrand = await prisma.brand.create({
    data: {
      name: 'Lenovo',
      discountPercent: 7,
      subBrands: {
        create: [
          { name: 'ThinkPad', discountPercent: 4 },
          { name: 'IdeaPad', discountPercent: 6 },
        ],
      },
    },
    include: { subBrands: true },
  });

  const dellBrand = await prisma.brand.create({
    data: {
      name: 'Dell',
      discountPercent: 6,
      subBrands: {
        create: [
          { name: 'XPS', discountPercent: 3 },
          { name: 'Inspiron', discountPercent: 5 },
        ],
      },
    },
    include: { subBrands: true },
  });

  // 4. Create Items (without inventory initially)
  console.log('📦 Creating items...');
  const items = await Promise.all([
    // Samsung Items
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0001',
        name: 'Samsung Galaxy S24 Ultra 256GB',
        description: '6.8" Dynamic AMOLED 2X, Snapdragon 8 Gen 3, 12GB RAM, 256GB Storage',
        brandId: samsungBrand.id,
        subBrandId: samsungBrand.subBrands[0].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 95000,
        mrp: 129999,
        sellingPrice: 124999,
        margin: 24,
        marginType: 'PERCENTAGE',
        discountPercent: 3,
        minStock: 5,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0002',
        name: 'Samsung Galaxy A54 5G 128GB',
        description: '6.4" Super AMOLED, Exynos 1380, 8GB RAM, 128GB Storage',
        brandId: samsungBrand.id,
        subBrandId: samsungBrand.subBrands[1].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 30000,
        mrp: 47999,
        sellingPrice: 44999,
        margin: 33,
        marginType: 'PERCENTAGE',
        discountPercent: 5,
        minStock: 10,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0003',
        name: 'Samsung Galaxy M34 5G',
        description: '6.5" Super AMOLED, Exynos 1280, 6GB RAM, 128GB Storage',
        brandId: samsungBrand.id,
        subBrandId: samsungBrand.subBrands[2].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 16000,
        mrp: 24999,
        sellingPrice: 22999,
        margin: 31,
        marginType: 'PERCENTAGE',
        discountPercent: 7,
        minStock: 15,
        unit: 'PCS',
      },
    }),
    // Apple Items
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0004',
        name: 'iPhone 15 Pro Max 256GB',
        description: '6.7" Super Retina XDR, A17 Pro chip, 256GB, Titanium',
        brandId: appleBrand.id,
        subBrandId: appleBrand.subBrands[0].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 135000,
        mrp: 159900,
        sellingPrice: 154900,
        margin: 12,
        marginType: 'PERCENTAGE',
        discountPercent: 1,
        minStock: 3,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0005',
        name: 'iPhone 14 128GB',
        description: '6.1" Super Retina XDR, A15 Bionic chip, 128GB',
        brandId: appleBrand.id,
        subBrandId: appleBrand.subBrands[0].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 58000,
        mrp: 69900,
        sellingPrice: 67900,
        margin: 14,
        marginType: 'PERCENTAGE',
        discountPercent: 1,
        minStock: 8,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0006',
        name: 'iPad Air M2 128GB',
        description: '11" Liquid Retina, M2 chip, 128GB, Wi-Fi',
        brandId: appleBrand.id,
        subBrandId: appleBrand.subBrands[1].id,
        hsnCode: '85171200',
        gstRate: 18,
        purchasePrice: 52000,
        mrp: 64900,
        sellingPrice: 62900,
        margin: 17,
        marginType: 'PERCENTAGE',
        discountPercent: 2,
        minStock: 5,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0007',
        name: 'MacBook Air M3 13" 256GB',
        description: '13.6" Liquid Retina, M3 chip, 8GB RAM, 256GB SSD',
        brandId: appleBrand.id,
        subBrandId: appleBrand.subBrands[2].id,
        hsnCode: '84713000',
        gstRate: 18,
        purchasePrice: 98000,
        mrp: 119900,
        sellingPrice: 115900,
        margin: 15,
        marginType: 'PERCENTAGE',
        discountPercent: 1.5,
        minStock: 4,
        unit: 'PCS',
      },
    }),
    // Lenovo Items
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0008',
        name: 'Lenovo ThinkPad X1 Carbon Gen 11',
        description: '14" WUXGA IPS, Intel i7-1365U, 16GB LPDDR5, 512GB SSD',
        brandId: lenovoBrand.id,
        subBrandId: lenovoBrand.subBrands[0].id,
        hsnCode: '84713000',
        gstRate: 18,
        purchasePrice: 95000,
        mrp: 135000,
        sellingPrice: 129000,
        margin: 26,
        marginType: 'PERCENTAGE',
        discountPercent: 4,
        minStock: 3,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0009',
        name: 'Lenovo IdeaPad Slim 3',
        description: '15.6" FHD, AMD Ryzen 5 7520U, 8GB RAM, 512GB SSD',
        brandId: lenovoBrand.id,
        subBrandId: lenovoBrand.subBrands[1].id,
        hsnCode: '84713000',
        gstRate: 18,
        purchasePrice: 35000,
        mrp: 54999,
        sellingPrice: 49999,
        margin: 29,
        marginType: 'PERCENTAGE',
        discountPercent: 6,
        minStock: 8,
        unit: 'PCS',
      },
    }),
    // Dell Items
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0010',
        name: 'Dell XPS 13 Plus',
        description: '13.4" FHD+, Intel i7-1360P, 16GB RAM, 512GB SSD',
        brandId: dellBrand.id,
        subBrandId: dellBrand.subBrands[0].id,
        hsnCode: '84713000',
        gstRate: 18,
        purchasePrice: 105000,
        mrp: 149999,
        sellingPrice: 142999,
        margin: 27,
        marginType: 'PERCENTAGE',
        discountPercent: 3,
        minStock: 2,
        unit: 'PCS',
      },
    }),
    prisma.item.create({
      data: {
        itemCode: 'ITEM-0011',
        name: 'Dell Inspiron 15 3520',
        description: '15.6" FHD, Intel i5-1235U, 8GB RAM, 512GB SSD',
        brandId: dellBrand.id,
        subBrandId: dellBrand.subBrands[1].id,
        hsnCode: '84713000',
        gstRate: 18,
        purchasePrice: 42000,
        mrp: 59999,
        sellingPrice: 54999,
        margin: 23,
        marginType: 'PERCENTAGE',
        discountPercent: 5,
        minStock: 6,
        unit: 'PCS',
      },
    }),
  ]);

  // 5. Create Customers
  console.log('👤 Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        customerNumber: 'CUST-0001',
        name: 'Tech Solutions Pvt Ltd',
        gstin: '27AABCT1234F1Z5',
        email: 'contact@techsolutions.com',
        phone: '+91-9876543210',
        address: '123, MG Road, Commercial Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        creditLimit: 1000000,
        creditDays: 30,
        openingBalance: 0,
        status: 'ACTIVE',
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: 'CUST-0002',
        name: 'Digital World Enterprises',
        gstin: '29AABCD5678G1ZA',
        email: 'orders@digitalworld.in',
        phone: '+91-9988776655',
        address: '456, Brigade Road, Tech Park',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        creditLimit: 500000,
        creditDays: 45,
        openingBalance: 85000,
        status: 'ACTIVE',
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: 'CUST-0003',
        name: 'Retail Hub',
        gstin: '33AABCR9012H1Z9',
        email: 'purchase@retailhub.com',
        phone: '+91-8877665544',
        address: '789, Anna Salai, Central Plaza',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        creditLimit: 300000,
        creditDays: 30,
        openingBalance: 0,
        status: 'ACTIVE',
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: 'CUST-0004',
        name: 'Smart Electronics',
        gstin: '24AABCS3456K1Z7',
        email: 'info@smartelec.com',
        phone: '+91-7766554433',
        address: '321, CG Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
        creditLimit: 400000,
        creditDays: 30,
        openingBalance: 0,
        status: 'ACTIVE',
      },
    }),
  ]);

  // 6. Create Vendors
  console.log('🏭 Creating vendors...');
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        vendorNumber: 'VEND-0001',
        name: 'Samsung India Electronics',
        gstin: '27AABCS1234E1Z1',
        email: 'b2b@samsung.co.in',
        phone: '+91-8000123456',
        address: 'Samsung Plaza, Sector 18, Gurgaon',
        city: 'Gurgaon',
        state: 'Haryana',
        pincode: '122001',
        creditDays: 60,
        openingBalance: -250000,
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'VEND-0002',
        name: 'Apple Authorized Distributor',
        gstin: '27AABCA5678F1Z2',
        email: 'wholesale@appledist.in',
        phone: '+91-8000234567',
        address: 'Apple Building, Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400051',
        creditDays: 45,
        openingBalance: -180000,
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'VEND-0003',
        name: 'Lenovo Distribution Ltd',
        gstin: '29AABCL9012G1Z3',
        email: 'sales@lenovodist.com',
        phone: '+91-8000345678',
        address: 'IT Park, Whitefield',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560066',
        creditDays: 30,
        openingBalance: -95000,
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'VEND-0004',
        name: 'Dell India Distribution',
        gstin: '27AABCD6789H1Z4',
        email: 'b2b@delldist.in',
        phone: '+91-8000456789',
        address: 'Dell Tower, Noida Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201301',
        creditDays: 45,
        openingBalance: -120000,
      },
    }),
  ]);

  // 7. Create Employees
  console.log('👨‍💼 Creating employees...');
  await Promise.all([
    prisma.employee.create({
      data: {
        employeeNumber: 'EMP-0001',
        name: 'Rajesh Kumar',
        email: 'rajesh@company.com',
        phone: '+91-9123456789',
        designation: 'Sales Manager',
        department: 'Sales',
        salary: 65000,
        joinDate: new Date('2022-01-15'),
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: 'EMP-0002',
        name: 'Priya Sharma',
        email: 'priya@company.com',
        phone: '+91-9234567890',
        designation: 'Accountant',
        department: 'Finance',
        salary: 55000,
        joinDate: new Date('2022-06-01'),
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: 'EMP-0003',
        name: 'Amit Patel',
        email: 'amit@company.com',
        phone: '+91-9345678901',
        designation: 'Warehouse Manager',
        department: 'Operations',
        salary: 50000,
        joinDate: new Date('2023-03-10'),
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: 'EMP-0004',
        name: 'Sneha Reddy',
        email: 'sneha@company.com',
        phone: '+91-9456789012',
        designation: 'Senior Sales Executive',
        department: 'Sales',
        salary: 45000,
        joinDate: new Date('2023-08-20'),
      },
    }),
  ]);

  // 8. Create Bank Accounts
  console.log('🏦 Creating bank accounts...');
  const cashAccount = await prisma.bankAccount.create({
    data: {
      accountName: 'Cash',
      accountNumber: 'CASH-001',
      bankName: 'Cash',
      accountType: 'CASH',
      openingBalance: 500000,
      currentBalance: 500000,
      isDefault: true,
    },
  });

  const hdfcAccount = await prisma.bankAccount.create({
    data: {
      accountName: 'Company Current Account',
      accountNumber: '1234567890123',
      bankName: 'HDFC Bank',
      ifscCode: 'HDFC0001234',
      branch: 'MG Road Branch',
      accountType: 'CURRENT',
      openingBalance: 2500000,
      currentBalance: 2500000,
    },
  });

  const iciciAccount = await prisma.bankAccount.create({
    data: {
      accountName: 'Sales Collection Account',
      accountNumber: '9876543210987',
      bankName: 'ICICI Bank',
      ifscCode: 'ICIC0009876',
      branch: 'Commercial Street',
      accountType: 'SAVINGS',
      openingBalance: 1250000,
      currentBalance: 1250000,
    },
  });

  // Bank opening balance ledger entries
  await Promise.all([
    prisma.bankLedger.create({
      data: {
        bankAccountId: cashAccount.id,
        date: new Date('2025-12-31'),
        description: 'Opening Balance',
        type: 'OPENING_BALANCE',
        debit: 0,
        credit: 500000,
        balance: 500000,
        referenceType: 'opening_balance',
        referenceId: cashAccount.id,
      },
    }),
    prisma.bankLedger.create({
      data: {
        bankAccountId: hdfcAccount.id,
        date: new Date('2025-12-31'),
        description: 'Opening Balance',
        type: 'OPENING_BALANCE',
        debit: 0,
        credit: 2500000,
        balance: 2500000,
        referenceType: 'opening_balance',
        referenceId: hdfcAccount.id,
      },
    }),
    prisma.bankLedger.create({
      data: {
        bankAccountId: iciciAccount.id,
        date: new Date('2025-12-31'),
        description: 'Opening Balance',
        type: 'OPENING_BALANCE',
        debit: 0,
        credit: 1250000,
        balance: 1250000,
        referenceType: 'opening_balance',
        referenceId: iciciAccount.id,
      },
    }),
  ]);

  // 9. Opening Balance Ledger Entries
  console.log('📒 Creating opening balance ledger entries...');

  // Customer opening balance
  await prisma.customerLedger.create({
    data: {
      customerId: customers[1].id,
      date: new Date('2025-12-31'),
      description: 'Opening Balance for FY 2026-27',
      type: 'OPENING_BALANCE',
      debit: 85000,
      credit: 0,
      balance: 85000,
      referenceType: 'opening_balance',
      referenceId: 'OB-CUST-0002',
    },
  });

  // Vendor opening balances
  for (let i = 0; i < vendors.length; i++) {
    await prisma.vendorLedger.create({
      data: {
        vendorId: vendors[i].id,
        date: new Date('2024-12-31'),
        description: 'Opening Balance for FY 2025-26',
        type: 'OPENING_BALANCE',
        debit: 0,
        credit: Math.abs(vendors[i].openingBalance.toNumber()),
        balance: vendors[i].openingBalance.toNumber(),
        referenceType: 'opening_balance',
        referenceId: `OB-${vendors[i].vendorNumber}`,
      },
    });
  }

  // ============================================
  // PURCHASE FLOW - Step by step
  // ============================================
  console.log('\n💰 Creating purchase transactions...');

  // PURCHASE 1: Samsung Products (Dec 2024)
  console.log('  📦 Purchase #1: Samsung products...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-0001',
      vendorId: vendors[0].id,
      vendorName: vendors[0].name,
      date: new Date('2025-12-15'),
      expectedDelivery: new Date('2025-12-20'),
      amount: 683000,
      taxAmount: 122940,
      totalAmount: 805940,
      status: 'RECEIVED',
      items: {
        create: [
          {
            itemId: items[0].id, // Samsung S24 Ultra
            quantity: 5,
            rate: 95000,
            taxRate: 18,
            taxAmount: 85500,
            amount: 475000,
          },
          {
            itemId: items[1].id, // Samsung A54
            quantity: 8,
            rate: 30000,
            taxRate: 18,
            taxAmount: 43200,
            amount: 240000,
          },
          {
            itemId: items[2].id, // Samsung M34
            quantity: 12,
            rate: 16000,
            taxRate: 18,
            taxAmount: 34560,
            amount: 192000,
          },
        ],
      },
    },
  });

  // Create Purchase Invoice for PO-0001
  const pi1 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-0001',
      vendorId: vendors[0].id,
      vendorName: vendors[0].name,
      purchaseOrderId: po1.id,
      date: new Date('2025-12-20'),
      dueDate: new Date('2026-02-18'),
      amount: 907000,
      taxAmount: 163260,
      totalAmount: 1070260,
      paidAmount: 500000,
      balanceAmount: 570260,
      status: 'PENDING',
      items: {
        create: [
          {
            itemId: items[0].id,
            quantity: 5,
            rate: 95000,
            taxRate: 18,
            taxAmount: 85500,
            amount: 475000,
          },
          {
            itemId: items[1].id,
            quantity: 8,
            rate: 30000,
            taxRate: 18,
            taxAmount: 43200,
            amount: 240000,
          },
          {
            itemId: items[2].id,
            quantity: 12,
            rate: 16000,
            taxRate: 18,
            taxAmount: 34560,
            amount: 192000,
          },
        ],
      },
    },
  });

  // Create Stock Movements for received items
  const inv1 = await prisma.inventory.create({
    data: {
      itemId: items[0].id,
      physicalStock: 5,
      reservedQuantity: 0,
      minStockLevel: 5,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv1.id,
      itemId: items[0].id,
      quantity: 5,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi1.id,
      notes: 'Stock received from Samsung - PI-0001',
      createdBy: admin.id,
    },
  });

  const inv2 = await prisma.inventory.create({
    data: {
      itemId: items[1].id,
      physicalStock: 8,
      reservedQuantity: 0,
      minStockLevel: 10,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv2.id,
      itemId: items[1].id,
      quantity: 8,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi1.id,
      notes: 'Stock received from Samsung - PI-0001',
      createdBy: admin.id,
    },
  });

  const inv3 = await prisma.inventory.create({
    data: {
      itemId: items[2].id,
      physicalStock: 12,
      reservedQuantity: 0,
      minStockLevel: 15,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv3.id,
      itemId: items[2].id,
      quantity: 12,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi1.id,
      notes: 'Stock received from Samsung - PI-0001',
      createdBy: admin.id,
    },
  });

  // Vendor Payment for PI-0001
  const vp1 = await prisma.vendorPayment.create({
    data: {
      paymentNumber: 'VP-0001',
      vendorId: vendors[0].id,
      purchaseInvoiceId: pi1.id,
      date: new Date('2025-12-22'),
      amount: 500000,
      mode: 'BANK_TRANSFER',
      paidFrom: hdfcAccount.id,
      bankAccountId: hdfcAccount.id,
      reference: 'NEFT9876543210',
      notes: 'Partial payment for PI-0001',
    },
  });

  // Bank ledger: VP-0001 debit from HDFC
  await prisma.bankLedger.create({
    data: {
      bankAccountId: hdfcAccount.id,
      date: new Date('2025-12-22'),
      description: 'Vendor Payment VP-0001 to Samsung India Electronics',
      type: 'PURCHASE_PAYMENT',
      debit: 500000,
      credit: 0,
      balance: 2500000 - 500000,
      referenceType: 'vendor_payment',
      referenceId: vp1.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: hdfcAccount.id },
    data: { currentBalance: { decrement: 500000 } },
  });

  // Vendor Ledger Entry
  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[0].id,
      date: new Date('2024-12-20'),
      description: 'Purchase Invoice PI-0001',
      type: 'PURCHASE_INVOICE',
      debit: 0,
      credit: 1070260,
      balance: -250000 - 1070260,
      referenceType: 'purchase_invoice',
      referenceId: pi1.id,
    },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[0].id,
      date: new Date('2025-12-22'),
      description: 'Payment VP-0001 against PI-0001',
      type: 'PURCHASE_PAYMENT',
      debit: 500000,
      credit: 0,
      balance: -250000 - 1070260 + 500000,
      referenceType: 'vendor_payment',
      referenceId: 'VP-0001',
    },
  });

  // PURCHASE 2: Apple Products (Jan 2025)
  console.log('  📦 Purchase #2: Apple products...');
  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-0002',
      vendorId: vendors[1].id,
      vendorName: vendors[1].name,
      date: new Date('2026-01-05'),
      expectedDelivery: new Date('2026-01-10'),
      amount: 646000,
      taxAmount: 116280,
      totalAmount: 762280,
      status: 'RECEIVED',
      items: {
        create: [
          {
            itemId: items[3].id, // iPhone 15 Pro Max
            quantity: 3,
            rate: 135000,
            taxRate: 18,
            taxAmount: 72900,
            amount: 405000,
          },
          {
            itemId: items[4].id, // iPhone 14
            quantity: 6,
            rate: 58000,
            taxRate: 18,
            taxAmount: 62640,
            amount: 348000,
          },
          {
            itemId: items[5].id, // iPad Air
            quantity: 5,
            rate: 52000,
            taxRate: 18,
            taxAmount: 46800,
            amount: 260000,
          },
          {
            itemId: items[6].id, // MacBook Air
            quantity: 3,
            rate: 98000,
            taxRate: 18,
            taxAmount: 52920,
            amount: 294000,
          },
        ],
      },
    },
  });

  const pi2 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-0002',
      vendorId: vendors[1].id,
      vendorName: vendors[1].name,
      purchaseOrderId: po2.id,
      date: new Date('2026-01-10'),
      dueDate: new Date('2026-02-24'),
      amount: 1307000,
      taxAmount: 235260,
      totalAmount: 1542260,
      paidAmount: 0,
      balanceAmount: 1542260,
      status: 'PENDING',
      items: {
        create: [
          {
            itemId: items[3].id,
            quantity: 3,
            rate: 135000,
            taxRate: 18,
            taxAmount: 72900,
            amount: 405000,
          },
          {
            itemId: items[4].id,
            quantity: 6,
            rate: 58000,
            taxRate: 18,
            taxAmount: 62640,
            amount: 348000,
          },
          {
            itemId: items[5].id,
            quantity: 5,
            rate: 52000,
            taxRate: 18,
            taxAmount: 46800,
            amount: 260000,
          },
          {
            itemId: items[6].id,
            quantity: 3,
            rate: 98000,
            taxRate: 18,
            taxAmount: 52920,
            amount: 294000,
          },
        ],
      },
    },
  });

  // Create inventory and stock movements for Apple products
  const inv4 = await prisma.inventory.create({
    data: {
      itemId: items[3].id,
      physicalStock: 3,
      reservedQuantity: 0,
      minStockLevel: 3,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv4.id,
      itemId: items[3].id,
      quantity: 3,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi2.id,
      notes: 'Stock received from Apple - PI-0002',
      createdBy: admin.id,
    },
  });

  const inv5 = await prisma.inventory.create({
    data: {
      itemId: items[4].id,
      physicalStock: 6,
      reservedQuantity: 0,
      minStockLevel: 8,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv5.id,
      itemId: items[4].id,
      quantity: 6,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi2.id,
      notes: 'Stock received from Apple - PI-0002',
      createdBy: admin.id,
    },
  });

  const inv6 = await prisma.inventory.create({
    data: {
      itemId: items[5].id,
      physicalStock: 5,
      reservedQuantity: 0,
      minStockLevel: 5,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv6.id,
      itemId: items[5].id,
      quantity: 5,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi2.id,
      notes: 'Stock received from Apple - PI-0002',
      createdBy: admin.id,
    },
  });

  const inv7 = await prisma.inventory.create({
    data: {
      itemId: items[6].id,
      physicalStock: 3,
      reservedQuantity: 0,
      minStockLevel: 4,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv7.id,
      itemId: items[6].id,
      quantity: 3,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi2.id,
      notes: 'Stock received from Apple - PI-0002',
      createdBy: admin.id,
    },
  });

  // Vendor Ledger for Apple
  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[1].id,
      date: new Date('2026-01-10'),
      description: 'Purchase Invoice PI-0002',
      type: 'PURCHASE_INVOICE',
      debit: 0,
      credit: 1542260,
      balance: -180000 - 1542260,
      referenceType: 'purchase_invoice',
      referenceId: pi2.id,
    },
  });

  // PURCHASE 3: Lenovo & Dell (Jan 2025)
  console.log('  📦 Purchase #3: Lenovo & Dell products...');
  const po3 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-0003',
      vendorId: vendors[2].id,
      vendorName: vendors[2].name,
      date: new Date('2026-01-08'),
      expectedDelivery: new Date('2026-01-15'),
      amount: 410000,
      taxAmount: 73800,
      totalAmount: 483800,
      status: 'RECEIVED',
      items: {
        create: [
          {
            itemId: items[7].id, // ThinkPad
            quantity: 3,
            rate: 95000,
            taxRate: 18,
            taxAmount: 51300,
            amount: 285000,
          },
          {
            itemId: items[8].id, // IdeaPad
            quantity: 8,
            rate: 35000,
            taxRate: 18,
            taxAmount: 50400,
            amount: 280000,
          },
        ],
      },
    },
  });

  const pi3 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-0003',
      vendorId: vendors[2].id,
      vendorName: vendors[2].name,
      purchaseOrderId: po3.id,
      date: new Date('2026-01-15'),
      dueDate: new Date('2026-02-14'),
      amount: 565000,
      taxAmount: 101700,
      totalAmount: 666700,
      paidAmount: 300000,
      balanceAmount: 366700,
      status: 'PENDING',
      items: {
        create: [
          {
            itemId: items[7].id,
            quantity: 3,
            rate: 95000,
            taxRate: 18,
            taxAmount: 51300,
            amount: 285000,
          },
          {
            itemId: items[8].id,
            quantity: 8,
            rate: 35000,
            taxRate: 18,
            taxAmount: 50400,
            amount: 280000,
          },
        ],
      },
    },
  });

  const inv8 = await prisma.inventory.create({
    data: {
      itemId: items[7].id,
      physicalStock: 3,
      reservedQuantity: 0,
      minStockLevel: 3,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv8.id,
      itemId: items[7].id,
      quantity: 3,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi3.id,
      notes: 'Stock received from Lenovo - PI-0003',
      createdBy: admin.id,
    },
  });

  const inv9 = await prisma.inventory.create({
    data: {
      itemId: items[8].id,
      physicalStock: 8,
      reservedQuantity: 0,
      minStockLevel: 8,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv9.id,
      itemId: items[8].id,
      quantity: 8,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi3.id,
      notes: 'Stock received from Lenovo - PI-0003',
      createdBy: admin.id,
    },
  });

  const vp2 = await prisma.vendorPayment.create({
    data: {
      paymentNumber: 'VP-0002',
      vendorId: vendors[2].id,
      purchaseInvoiceId: pi3.id,
      date: new Date('2026-01-16'),
      amount: 300000,
      mode: 'BANK_TRANSFER',
      paidFrom: hdfcAccount.id,
      bankAccountId: hdfcAccount.id,
      reference: 'RTGS1234567890',
      notes: 'Partial payment for PI-0003',
    },
  });

  // Bank ledger: VP-0002 debit from HDFC (balance now: 2000000 - 300000 = 1700000)
  await prisma.bankLedger.create({
    data: {
      bankAccountId: hdfcAccount.id,
      date: new Date('2026-01-16'),
      description: 'Vendor Payment VP-0002 to Lenovo Distribution Ltd',
      type: 'PURCHASE_PAYMENT',
      debit: 300000,
      credit: 0,
      balance: 2000000 - 300000,
      referenceType: 'vendor_payment',
      referenceId: vp2.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: hdfcAccount.id },
    data: { currentBalance: { decrement: 300000 } },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[2].id,
      date: new Date('2026-01-15'),
      description: 'Purchase Invoice PI-0003',
      type: 'PURCHASE_INVOICE',
      debit: 0,
      credit: 666700,
      balance: -95000 - 666700,
      referenceType: 'purchase_invoice',
      referenceId: pi3.id,
    },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[2].id,
      date: new Date('2026-01-16'),
      description: 'Payment VP-0002 against PI-0003',
      type: 'PURCHASE_PAYMENT',
      debit: 300000,
      credit: 0,
      balance: -95000 - 666700 + 300000,
      referenceType: 'vendor_payment',
      referenceId: 'VP-0002',
    },
  });

  // PURCHASE 4: Dell Products
  console.log('  📦 Purchase #4: Dell products...');
  const po4 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-0004',
      vendorId: vendors[3].id,
      vendorName: vendors[3].name,
      date: new Date('2026-01-12'),
      expectedDelivery: new Date('2026-01-18'),
      amount: 357000,
      taxAmount: 64260,
      totalAmount: 421260,
      status: 'RECEIVED',
      items: {
        create: [
          {
            itemId: items[9].id, // Dell XPS
            quantity: 2,
            rate: 105000,
            taxRate: 18,
            taxAmount: 37800,
            amount: 210000,
          },
          {
            itemId: items[10].id, // Dell Inspiron
            quantity: 7,
            rate: 42000,
            taxRate: 18,
            taxAmount: 52920,
            amount: 294000,
          },
        ],
      },
    },
  });

  const pi4 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-0004',
      vendorId: vendors[3].id,
      vendorName: vendors[3].name,
      purchaseOrderId: po4.id,
      date: new Date('2026-01-18'),
      dueDate: new Date('2026-03-04'),
      amount: 504000,
      taxAmount: 90720,
      totalAmount: 594720,
      paidAmount: 250000,
      balanceAmount: 344720,
      status: 'PENDING',
      items: {
        create: [
          {
            itemId: items[9].id,
            quantity: 2,
            rate: 105000,
            taxRate: 18,
            taxAmount: 37800,
            amount: 210000,
          },
          {
            itemId: items[10].id,
            quantity: 7,
            rate: 42000,
            taxRate: 18,
            taxAmount: 52920,
            amount: 294000,
          },
        ],
      },
    },
  });

  const inv10 = await prisma.inventory.create({
    data: {
      itemId: items[9].id,
      physicalStock: 2,
      reservedQuantity: 0,
      minStockLevel: 2,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv10.id,
      itemId: items[9].id,
      quantity: 2,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi4.id,
      notes: 'Stock received from Dell - PI-0004',
      createdBy: admin.id,
    },
  });

  const inv11 = await prisma.inventory.create({
    data: {
      itemId: items[10].id,
      physicalStock: 7,
      reservedQuantity: 0,
      minStockLevel: 6,
    },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv11.id,
      itemId: items[10].id,
      quantity: 7,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: pi4.id,
      notes: 'Stock received from Dell - PI-0004',
      createdBy: admin.id,
    },
  });

  const vp3 = await prisma.vendorPayment.create({
    data: {
      paymentNumber: 'VP-0003',
      vendorId: vendors[3].id,
      purchaseInvoiceId: pi4.id,
      date: new Date('2026-01-20'),
      amount: 250000,
      mode: 'BANK_TRANSFER',
      paidFrom: iciciAccount.id,
      bankAccountId: iciciAccount.id,
      reference: 'IMPS2345678901',
      notes: 'Partial payment for PI-0004',
    },
  });

  // Bank ledger: VP-0003 debit from ICICI (balance: 1250000 - 250000 = 1000000)
  await prisma.bankLedger.create({
    data: {
      bankAccountId: iciciAccount.id,
      date: new Date('2026-01-20'),
      description: 'Vendor Payment VP-0003 to Dell India Distribution',
      type: 'PURCHASE_PAYMENT',
      debit: 250000,
      credit: 0,
      balance: 1250000 - 250000,
      referenceType: 'vendor_payment',
      referenceId: vp3.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: iciciAccount.id },
    data: { currentBalance: { decrement: 250000 } },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[3].id,
      date: new Date('2026-01-18'),
      description: 'Purchase Invoice PI-0004',
      type: 'PURCHASE_INVOICE',
      debit: 0,
      credit: 594720,
      balance: -120000 - 594720,
      referenceType: 'purchase_invoice',
      referenceId: pi4.id,
    },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[3].id,
      date: new Date('2026-01-20'),
      description: 'Payment VP-0003 against PI-0004',
      type: 'PURCHASE_PAYMENT',
      debit: 250000,
      credit: 0,
      balance: -120000 - 594720 + 250000,
      referenceType: 'vendor_payment',
      referenceId: 'VP-0003',
    },
  });

  // ============================================
  // SALES FLOW - Complete with stock deduction
  // ============================================
  console.log('\n🛍️  Creating sales transactions...');

  // SALE 1: Tech Solutions - Multiple Samsung items
  console.log('  📝 Sale #1: Tech Solutions...');
  const so1 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0001',
      orderDate: new Date('2026-01-20'),
      customerId: customers[0].id,
      expectedDelivery: new Date('2026-01-25'),
      status: 'FULLY_INVOICED',
      subtotal: 394996,
      discountAmount: 11850,
      taxAmount: 68994,
      totalAmount: 452140,
      createdBy: salesman.id,
      notes: 'Bulk order for office setup',
      items: {
        create: [
          {
            itemId: items[0].id, // S24 Ultra
            quantity: 2,
            invoicedQuantity: 2,
            rate: 124999,
            discountPercent: 3,
            taxRate: 18,
            taxAmount: 43200,
            amount: 240000,
          },
          {
            itemId: items[1].id, // A54
            quantity: 4,
            invoicedQuantity: 4,
            rate: 44999,
            discountPercent: 5,
            taxRate: 18,
            taxAmount: 30240,
            amount: 168000,
          },
        ],
      },
    },
  });

  // Status history
  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so1.id,
      fromStatus: null,
      toStatus: 'OPEN',
      reason: 'Order created',
      changedBy: salesman.id,
      changedAt: new Date('2026-01-20'),
    },
  });

  // Create invoice
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-0001',
      invoiceDate: new Date('2026-01-22'),
      salesOrderId: so1.id,
      orderNumber: so1.orderNumber,
      customerId: customers[0].id,
      subtotal: 408000,
      cgst: 36720,
      sgst: 36720,
      taxAmount: 73440,
      roundOff: -2,
      totalAmount: 481438,
      paidAmount: 250000,
      balanceAmount: 231438,
      paymentStatus: 'PARTIAL',
      dueDate: new Date('2026-02-21'),
      items: {
        create: [
          {
            itemId: items[0].id,
            quantity: 2,
            rate: 124999,
            discountPercent: 3,
            taxRate: 18,
            taxAmount: 43200,
            amount: 240000,
          },
          {
            itemId: items[1].id,
            quantity: 4,
            rate: 44999,
            discountPercent: 5,
            taxRate: 18,
            taxAmount: 30240,
            amount: 168000,
          },
        ],
      },
    },
  });

  // Update inventory and create stock movements
  await prisma.inventory.update({
    where: { id: inv1.id },
    data: { physicalStock: { decrement: 2 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv1.id,
      itemId: items[0].id,
      quantity: -2,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice1.id,
      notes: 'Sold via INV-0001 to Tech Solutions',
      createdBy: salesman.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inv2.id },
    data: { physicalStock: { decrement: 4 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv2.id,
      itemId: items[1].id,
      quantity: -4,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice1.id,
      notes: 'Sold via INV-0001 to Tech Solutions',
      createdBy: salesman.id,
    },
  });

  // Payment received (deposited to HDFC — balance: 1700000 + 250000 = 1950000)
  const payment1 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-0001',
      paymentDate: new Date('2026-01-22'),
      customerId: customers[0].id,
      invoiceId: invoice1.id,
      amount: 250000,
      mode: 'BANK_TRANSFER',
      referenceNumber: 'NEFT20250122001',
      bankAccountId: hdfcAccount.id,
      notes: 'Partial payment against INV-0001',
      allocations: {
        create: [
          {
            invoiceId: invoice1.id,
            amount: 250000,
          },
        ],
      },
    },
  });

  // Bank ledger: PAY-0001 credit to HDFC
  await prisma.bankLedger.create({
    data: {
      bankAccountId: hdfcAccount.id,
      date: new Date('2026-01-22'),
      description: 'Sales Receipt PAY-0001 from Tech Solutions Pvt Ltd',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 250000,
      balance: 1700000 + 250000,
      referenceType: 'sales_receipt',
      referenceId: payment1.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: hdfcAccount.id },
    data: { currentBalance: { increment: 250000 } },
  });

  // Customer Ledger
  await prisma.customerLedger.create({
    data: {
      customerId: customers[0].id,
      date: new Date('2026-01-22'),
      description: 'Sales Invoice INV-0001',
      type: 'SALES_INVOICE',
      debit: 481438,
      credit: 0,
      balance: 481438,
      referenceType: 'sales_invoice',
      referenceId: invoice1.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[0].id,
      date: new Date('2026-01-22'),
      description: 'Payment received PAY-0001',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 250000,
      balance: 231438,
      referenceType: 'sales_receipt',
      referenceId: payment1.id,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so1.id,
      fromStatus: 'OPEN',
      toStatus: 'FULLY_INVOICED',
      reason: 'Invoice INV-0001 created',
      changedBy: salesman.id,
      changedAt: new Date('2026-01-22'),
    },
  });

  // Update SO status
  await prisma.salesOrder.update({
    where: { id: so1.id },
    data: { status: 'FULLY_INVOICED' },
  });

  // SALE 2: Digital World - Apple products (with opening balance)
  console.log('  📝 Sale #2: Digital World...');
  const so2 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0002',
      orderDate: new Date('2026-01-23'),
      customerId: customers[1].id,
      expectedDelivery: new Date('2026-01-28'),
      status: 'FULLY_INVOICED',
      subtotal: 322800,
      discountAmount: 4842,
      taxAmount: 57233,
      totalAmount: 375191,
      createdBy: salesman.id,
      items: {
        create: [
          {
            itemId: items[4].id, // iPhone 14
            quantity: 3,
            invoicedQuantity: 3,
            rate: 67900,
            discountPercent: 1,
            taxRate: 18,
            taxAmount: 36612,
            amount: 203700,
          },
          {
            itemId: items[5].id, // iPad Air
            quantity: 2,
            invoicedQuantity: 2,
            rate: 62900,
            discountPercent: 2,
            taxRate: 18,
            taxAmount: 22621,
            amount: 125800,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so2.id,
      fromStatus: null,
      toStatus: 'OPEN',
      changedBy: salesman.id,
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-0002',
      invoiceDate: new Date('2026-01-25'),
      salesOrderId: so2.id,
      orderNumber: so2.orderNumber,
      customerId: customers[1].id,
      subtotal: 329400,
      cgst: 29646,
      sgst: 29646,
      taxAmount: 59292,
      roundOff: -3,
      totalAmount: 388689,
      paidAmount: 388689,
      balanceAmount: 0,
      paymentStatus: 'PAID',
      dueDate: new Date('2026-03-11'),
      items: {
        create: [
          {
            itemId: items[4].id,
            quantity: 3,
            rate: 67900,
            discountPercent: 1,
            taxRate: 18,
            taxAmount: 36612,
            amount: 203700,
          },
          {
            itemId: items[5].id,
            quantity: 2,
            rate: 62900,
            discountPercent: 2,
            taxRate: 18,
            taxAmount: 22621,
            amount: 125800,
          },
        ],
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inv5.id },
    data: { physicalStock: { decrement: 3 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv5.id,
      itemId: items[4].id,
      quantity: -3,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice2.id,
      notes: 'Sold via INV-0002 to Digital World',
      createdBy: salesman.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inv6.id },
    data: { physicalStock: { decrement: 2 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv6.id,
      itemId: items[5].id,
      quantity: -2,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice2.id,
      notes: 'Sold via INV-0002 to Digital World',
      createdBy: salesman.id,
    },
  });

  // PAY-0002 deposited to ICICI (balance: 1000000 + 388689 = 1388689)
  const payment2 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-0002',
      paymentDate: new Date('2026-01-25'),
      customerId: customers[1].id,
      invoiceId: invoice2.id,
      amount: 388689,
      mode: 'UPI',
      referenceNumber: 'UPI202501251145',
      bankAccountId: iciciAccount.id,
      notes: 'Full payment via UPI',
      allocations: {
        create: [
          {
            invoiceId: invoice2.id,
            amount: 388689,
          },
        ],
      },
    },
  });

  // Bank ledger: PAY-0002 credit to ICICI
  await prisma.bankLedger.create({
    data: {
      bankAccountId: iciciAccount.id,
      date: new Date('2026-01-25'),
      description: 'Sales Receipt PAY-0002 from Digital World Enterprises',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 388689,
      balance: 1000000 + 388689,
      referenceType: 'sales_receipt',
      referenceId: payment2.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: iciciAccount.id },
    data: { currentBalance: { increment: 388689 } },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[1].id,
      date: new Date('2026-01-25'),
      description: 'Sales Invoice INV-0002',
      type: 'SALES_INVOICE',
      debit: 388689,
      credit: 0,
      balance: 85000 + 388689,
      referenceType: 'sales_invoice',
      referenceId: invoice2.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[1].id,
      date: new Date('2026-01-25'),
      description: 'Payment received PAY-0002',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 388689,
      balance: 85000,
      referenceType: 'sales_receipt',
      referenceId: payment2.id,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so2.id,
      fromStatus: 'OPEN',
      toStatus: 'FULLY_INVOICED',
      reason: 'Invoice INV-0002 created and paid',
      changedBy: salesman.id,
    },
  });

  await prisma.salesOrder.update({
    where: { id: so2.id },
    data: { status: 'FULLY_INVOICED' },
  });

  // SALE 3: Retail Hub - Samsung M34 bulk order
  console.log('  📝 Sale #3: Retail Hub...');
  const so3 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0003',
      orderDate: new Date('2026-01-26'),
      customerId: customers[2].id,
      expectedDelivery: new Date('2026-01-30'),
      status: 'FULLY_INVOICED',
      subtotal: 183992,
      discountAmount: 12879,
      taxAmount: 30800,
      totalAmount: 201913,
      createdBy: salesman.id,
      notes: 'Bulk order for retail distribution',
      items: {
        create: [
          {
            itemId: items[2].id, // Samsung M34
            quantity: 8,
            invoicedQuantity: 8,
            rate: 22999,
            discountPercent: 7,
            taxRate: 18,
            taxAmount: 30800,
            amount: 171200,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so3.id,
      fromStatus: null,
      toStatus: 'OPEN',
      changedBy: salesman.id,
    },
  });

  const invoice3 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-0003',
      invoiceDate: new Date('2026-01-27'),
      salesOrderId: so3.id,
      orderNumber: so3.orderNumber,
      customerId: customers[2].id,
      subtotal: 183992,
      cgst: 16559,
      sgst: 16559,
      taxAmount: 33118,
      roundOff: -1,
      totalAmount: 217109,
      paidAmount: 0,
      balanceAmount: 217109,
      paymentStatus: 'PENDING',
      dueDate: new Date('2026-02-26'),
      items: {
        create: [
          {
            itemId: items[2].id,
            quantity: 8,
            rate: 22999,
            discountPercent: 7,
            taxRate: 18,
            taxAmount: 33118,
            amount: 183992,
          },
        ],
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inv3.id },
    data: { physicalStock: { decrement: 8 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv3.id,
      itemId: items[2].id,
      quantity: -8,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice3.id,
      notes: 'Sold via INV-0003 to Retail Hub',
      createdBy: salesman.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[2].id,
      date: new Date('2026-01-27'),
      description: 'Sales Invoice INV-0003',
      type: 'SALES_INVOICE',
      debit: 217109,
      credit: 0,
      balance: 217109,
      referenceType: 'sales_invoice',
      referenceId: invoice3.id,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so3.id,
      fromStatus: 'OPEN',
      toStatus: 'FULLY_INVOICED',
      reason: 'Invoice INV-0003 created',
      changedBy: salesman.id,
    },
  });

  await prisma.salesOrder.update({
    where: { id: so3.id },
    data: { status: 'FULLY_INVOICED' },
  });

  // SALE 4: Smart Electronics - Lenovo laptops
  console.log('  📝 Sale #4: Smart Electronics...');
  const so4 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0004',
      orderDate: new Date('2026-01-28'),
      customerId: customers[3].id,
      expectedDelivery: new Date('2026-02-02'),
      status: 'PARTIALLY_INVOICED',
      subtotal: 328000,
      discountAmount: 19680,
      taxAmount: 55497,
      totalAmount: 363817,
      createdBy: salesman.id,
      items: {
        create: [
          {
            itemId: items[7].id, // ThinkPad
            quantity: 2,
            invoicedQuantity: 1,
            rate: 129000,
            discountPercent: 4,
            taxRate: 18,
            taxAmount: 44524,
            amount: 247456,
          },
          {
            itemId: items[8].id, // IdeaPad
            quantity: 3,
            invoicedQuantity: 2,
            rate: 49999,
            discountPercent: 6,
            taxRate: 18,
            taxAmount: 24210,
            amount: 134500,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so4.id,
      fromStatus: null,
      toStatus: 'OPEN',
      changedBy: salesman.id,
    },
  });

  // Partial invoice
  const invoice4 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-0004',
      invoiceDate: new Date('2026-01-30'),
      salesOrderId: so4.id,
      orderNumber: so4.orderNumber,
      customerId: customers[3].id,
      subtotal: 217638,
      cgst: 19587,
      sgst: 19587,
      taxAmount: 39174,
      roundOff: 0,
      totalAmount: 256812,
      paidAmount: 150000,
      balanceAmount: 106812,
      paymentStatus: 'PARTIAL',
      dueDate: new Date('2026-03-01'),
      items: {
        create: [
          {
            itemId: items[7].id,
            quantity: 1,
            rate: 129000,
            discountPercent: 4,
            taxRate: 18,
            taxAmount: 22262,
            amount: 123840,
          },
          {
            itemId: items[8].id,
            quantity: 2,
            rate: 49999,
            discountPercent: 6,
            taxRate: 18,
            taxAmount: 16912,
            amount: 93998,
          },
        ],
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inv8.id },
    data: { physicalStock: { decrement: 1 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv8.id,
      itemId: items[7].id,
      quantity: -1,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice4.id,
      notes: 'Sold via INV-0004 to Smart Electronics',
      createdBy: salesman.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inv9.id },
    data: { physicalStock: { decrement: 2 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv9.id,
      itemId: items[8].id,
      quantity: -2,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice4.id,
      notes: 'Sold via INV-0004 to Smart Electronics',
      createdBy: salesman.id,
    },
  });

  // PAY-0003 cheque deposited to HDFC (balance: 1950000 + 150000 = 2100000)
  const payment3 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-0003',
      paymentDate: new Date('2026-01-30'),
      customerId: customers[3].id,
      invoiceId: invoice4.id,
      amount: 150000,
      mode: 'CHEQUE',
      referenceNumber: 'CHQ897456',
      bankAccountId: hdfcAccount.id,
      chequeCollected: true,
      chequeCollectedDate: new Date('2026-02-01'),
      notes: 'Partial payment via cheque',
      allocations: {
        create: [
          {
            invoiceId: invoice4.id,
            amount: 150000,
          },
        ],
      },
    },
  });

  // Bank ledger: PAY-0003 credit to HDFC
  await prisma.bankLedger.create({
    data: {
      bankAccountId: hdfcAccount.id,
      date: new Date('2026-01-30'),
      description: 'Sales Receipt PAY-0003 from Smart Electronics',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 150000,
      balance: 1950000 + 150000,
      referenceType: 'sales_receipt',
      referenceId: payment3.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: hdfcAccount.id },
    data: { currentBalance: { increment: 150000 } },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[3].id,
      date: new Date('2026-01-30'),
      description: 'Sales Invoice INV-0004',
      type: 'SALES_INVOICE',
      debit: 256812,
      credit: 0,
      balance: 256812,
      referenceType: 'sales_invoice',
      referenceId: invoice4.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[3].id,
      date: new Date('2026-01-30'),
      description: 'Payment received PAY-0003',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 150000,
      balance: 106812,
      referenceType: 'sales_receipt',
      referenceId: payment3.id,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so4.id,
      fromStatus: 'OPEN',
      toStatus: 'PARTIALLY_INVOICED',
      reason: 'Partial invoice INV-0004 created',
      changedBy: salesman.id,
    },
  });

  await prisma.salesOrder.update({
    where: { id: so4.id },
    data: { status: 'PARTIALLY_INVOICED' },
  });

  // Update invoiced quantities in sales order items
  const so4Items = await prisma.salesOrderItem.findMany({
    where: { salesOrderId: so4.id },
  });
  await prisma.salesOrderItem.updateMany({
    where: { salesOrderId: so4.id, itemId: items[7].id },
    data: { invoicedQuantity: 1 },
  });
  await prisma.salesOrderItem.updateMany({
    where: { salesOrderId: so4.id, itemId: items[8].id },
    data: { invoicedQuantity: 2 },
  });

  // SALE 5: Direct invoice without order - Apple MacBook
  console.log('  📝 Sale #5: Tech Solutions (Direct Invoice)...');
  const invoice5 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-0005',
      invoiceDate: new Date('2026-02-01'),
      customerId: customers[0].id,
      subtotal: 231800,
      cgst: 20862,
      sgst: 20862,
      taxAmount: 41724,
      roundOff: 0,
      totalAmount: 273524,
      paidAmount: 273524,
      balanceAmount: 0,
      paymentStatus: 'PAID',
      dueDate: new Date('2026-03-03'),
      notes: 'Direct sale without order',
      items: {
        create: [
          {
            itemId: items[6].id, // MacBook Air
            quantity: 2,
            rate: 115900,
            discountPercent: 1.5,
            taxRate: 18,
            taxAmount: 41724,
            amount: 231800,
          },
        ],
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inv7.id },
    data: { physicalStock: { decrement: 2 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv7.id,
      itemId: items[6].id,
      quantity: -2,
      type: 'SALE',
      referenceType: 'SALES_INVOICE',
      referenceId: invoice5.id,
      notes: 'Direct sale via INV-0005',
      createdBy: salesman.id,
    },
  });

  // PAY-0004 deposited to ICICI (balance: 1388689 + 273524 = 1662213)
  const payment4 = await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-0004',
      paymentDate: new Date('2026-02-01'),
      customerId: customers[0].id,
      invoiceId: invoice5.id,
      amount: 273524,
      mode: 'CARD',
      referenceNumber: 'CARD1234567890',
      bankAccountId: iciciAccount.id,
      notes: 'Full payment via credit card',
      allocations: {
        create: [
          {
            invoiceId: invoice5.id,
            amount: 273524,
          },
        ],
      },
    },
  });

  // Bank ledger: PAY-0004 credit to ICICI
  await prisma.bankLedger.create({
    data: {
      bankAccountId: iciciAccount.id,
      date: new Date('2026-02-01'),
      description: 'Sales Receipt PAY-0004 from Tech Solutions Pvt Ltd',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 273524,
      balance: 1388689 + 273524,
      referenceType: 'sales_receipt',
      referenceId: payment4.id,
    },
  });
  await prisma.bankAccount.update({
    where: { id: iciciAccount.id },
    data: { currentBalance: { increment: 273524 } },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[0].id,
      date: new Date('2026-02-01'),
      description: 'Sales Invoice INV-0005',
      type: 'SALES_INVOICE',
      debit: 273524,
      credit: 0,
      balance: 231438 + 273524,
      referenceType: 'sales_invoice',
      referenceId: invoice5.id,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[0].id,
      date: new Date('2026-02-01'),
      description: 'Payment received PAY-0004',
      type: 'SALES_RECEIPT',
      debit: 0,
      credit: 273524,
      balance: 231438,
      referenceType: 'sales_receipt',
      referenceId: payment4.id,
    },
  });

  // ============================================
  // RETURNS
  // ============================================
  console.log('\n↩️  Creating return transactions...');

  // Sales Return - Samsung A54 defective
  console.log('  📦 Sales Return #1...');
  const sr1 = await prisma.salesReturn.create({
    data: {
      returnNumber: 'SR-0001',
      returnDate: new Date('2026-02-02'),
      customerId: customers[0].id,
      invoiceId: invoice1.id,
      subtotal: 44999,
      cgst: 4050,
      sgst: 4050,
      taxAmount: 8100,
      totalAmount: 53099,
      reason: 'Display defect - dead pixels',
      status: 'COMPLETED',
      items: {
        create: [
          {
            itemId: items[1].id,
            quantity: 1,
            rate: 44999,
            taxRate: 18,
            taxAmount: 8100,
            amount: 53099,
          },
        ],
      },
    },
  });

  // Return stock
  await prisma.inventory.update({
    where: { id: inv2.id },
    data: { physicalStock: { increment: 1 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv2.id,
      itemId: items[1].id,
      quantity: 1,
      type: 'RETURN',
      referenceType: 'SALES_RETURN',
      referenceId: sr1.id,
      notes: 'Returned from Tech Solutions - SR-0001',
      createdBy: admin.id,
    },
  });

  // Update invoice balance
  await prisma.invoice.update({
    where: { id: invoice1.id },
    data: {
      balanceAmount: { decrement: 53099 },
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: customers[0].id,
      date: new Date('2026-02-02'),
      description: 'Sales Return SR-0001',
      type: 'SALES_RETURN',
      debit: 0,
      credit: 53099,
      balance: 231438 - 53099,
      referenceType: 'sales_return',
      referenceId: sr1.id,
    },
  });

  // Purchase Return - Samsung M34 damaged
  console.log('  🔙 Purchase Return #1...');
  const pr1 = await prisma.purchaseReturn.create({
    data: {
      returnNumber: 'PR-0001',
      vendorId: vendors[0].id,
      vendorName: vendors[0].name,
      purchaseInvoiceId: pi1.id,
      date: new Date('2026-01-25'),
      amount: 16000,
      taxAmount: 2880,
      totalAmount: 18880,
      status: 'COMPLETED',
      reason: 'Damaged packaging',
      items: {
        create: [
          {
            itemId: items[2].id,
            quantity: 1,
            rate: 16000,
            taxRate: 18,
            taxAmount: 2880,
            amount: 18880,
          },
        ],
      },
    },
  });

  await prisma.inventory.update({
    where: { id: inv3.id },
    data: { physicalStock: { decrement: 1 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv3.id,
      itemId: items[2].id,
      quantity: -1,
      type: 'RETURN',
      referenceType: 'PURCHASE_RETURN',
      referenceId: pr1.id,
      notes: 'Returned to Samsung - PR-0001',
      createdBy: admin.id,
    },
  });

  await prisma.purchaseInvoice.update({
    where: { id: pi1.id },
    data: {
      balanceAmount: { decrement: 18880 },
    },
  });

  await prisma.vendorLedger.create({
    data: {
      vendorId: vendors[0].id,
      date: new Date('2026-01-25'),
      description: 'Purchase Return PR-0001',
      type: 'PURCHASE_RETURN',
      debit: 18880,
      credit: 0,
      balance: -820260 + 18880,
      referenceType: 'purchase_return',
      referenceId: pr1.id,
    },
  });

  // ============================================
  // STOCK ADJUSTMENTS
  // ============================================
  console.log('\n🔧 Creating stock adjustments...');

  const sj1 = await prisma.stockJournal.create({
    data: {
      journalNumber: 'SJ-0001',
      date: new Date('2026-02-03'),
      itemId: items[9].id,
      quantity: -1,
      type: 'DAMAGE',
      reason: 'Laptop screen damaged during internal handling',
      createdBy: admin.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inv10.id },
    data: { physicalStock: { decrement: 1 } },
  });
  await prisma.stockMovement.create({
    data: {
      inventoryId: inv10.id,
      itemId: items[9].id,
      quantity: -1,
      type: 'DAMAGE',
      referenceType: 'STOCK_JOURNAL',
      referenceId: sj1.id,
      notes: 'Stock adjustment - SJ-0001: Screen damage',
      createdBy: admin.id,
    },
  });

  // ============================================
  // RATE SHEETS
  // ============================================
  console.log('\n💰 Creating rate sheets...');

  await prisma.rateSheet.create({
    data: {
      name: 'Premium Customer Rate - H1 2026',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-06-30'),
      discountPercent: 8,
      isActive: true,
      useInclusionModel: true,
      inclusionDiscounts: {
        brands: [
          { id: samsungBrand.id, discountPercent: 10 },
          { id: lenovoBrand.id, discountPercent: 8 },
        ],
        items: [
          { id: items[0].id, discountPercent: 12 },
          { id: items[7].id, discountPercent: 10 },
        ],
      },
      customers: {
        create: [
          { customerId: customers[0].id },
          { customerId: customers[3].id },
        ],
      },
    },
  });

  await prisma.rateSheet.create({
    data: {
      name: 'Standard Rate - H1 2026',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-06-30'),
      discountPercent: 5,
      isActive: true,
      useInclusionModel: false,
      excludedBrandIds: [appleBrand.id],
      customers: {
        create: [
          { customerId: customers[1].id },
          { customerId: customers[2].id },
        ],
      },
    },
  });

  // ============================================
  // OPEN SALES ORDERS (with inventory reservations)
  // ============================================
  console.log('\n📋 Creating open sales orders with reservations...');

  // SO-0005: Tech Solutions - Samsung items (OPEN, reserved)
  // Current stock: S24 Ultra=3, A54=5
  const so5 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0005',
      orderDate: new Date('2026-02-10'),
      customerId: customers[0].id,
      expectedDelivery: new Date('2026-02-20'),
      status: 'OPEN',
      subtotal: 204146,
      discountAmount: 0,
      taxAmount: 36746,
      totalAmount: 240892,
      createdBy: salesman.id,
      notes: 'Office refresh - Samsung phones',
      items: {
        create: [
          {
            itemId: items[0].id, // S24 Ultra - MRP 129999, 12% discount via rate sheet
            quantity: 1,
            rate: 114399, // calculateInclusiveTaxRate(129999, 18, 12)
            discountPercent: 12,
            taxRate: 18,
            taxAmount: 17417,
            amount: 96982,
          },
          {
            itemId: items[1].id, // A54 - MRP 47999, 10% discount via rate sheet (Samsung brand)
            quantity: 2,
            rate: 43199, // calculateInclusiveTaxRate(47999, 18, 10)
            discountPercent: 10,
            taxRate: 18,
            taxAmount: 13178,
            amount: 73220,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so5.id,
      fromStatus: null,
      toStatus: 'OPEN',
      reason: 'Order created',
      changedBy: salesman.id,
      changedAt: new Date('2026-02-10'),
    },
  });

  // Reserve inventory for SO-0005
  await prisma.inventory.update({
    where: { id: inv1.id }, // S24 Ultra
    data: { reservedQuantity: { increment: 1 } },
  });
  await prisma.inventory.update({
    where: { id: inv2.id }, // A54
    data: { reservedQuantity: { increment: 2 } },
  });

  // SO-0006: Retail Hub - Apple items (OPEN, reserved)
  // Current stock: iPhone 14=3, iPad Air=3
  const so6 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0006',
      orderDate: new Date('2026-02-12'),
      customerId: customers[2].id,
      expectedDelivery: new Date('2026-02-22'),
      status: 'OPEN',
      subtotal: 252900,
      discountAmount: 0,
      taxAmount: 45522,
      totalAmount: 298422,
      createdBy: salesman.id,
      notes: 'Retail stock replenishment',
      items: {
        create: [
          {
            itemId: items[4].id, // iPhone 14 - sellingPrice 67900, 5% discount (standard rate, non-Apple excluded)
            quantity: 2,
            rate: 67900, // Apple is excluded from Standard Rate sheet, so selling price used, 0% disc
            discountPercent: 0,
            taxRate: 18,
            taxAmount: 24444,
            amount: 135800,
          },
          {
            itemId: items[5].id, // iPad Air - sellingPrice 62900, Apple excluded
            quantity: 1,
            rate: 62900,
            discountPercent: 0,
            taxRate: 18,
            taxAmount: 11322,
            amount: 62900,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so6.id,
      fromStatus: null,
      toStatus: 'OPEN',
      reason: 'Order created',
      changedBy: salesman.id,
      changedAt: new Date('2026-02-12'),
    },
  });

  // Reserve inventory for SO-0006
  await prisma.inventory.update({
    where: { id: inv5.id }, // iPhone 14
    data: { reservedQuantity: { increment: 2 } },
  });
  await prisma.inventory.update({
    where: { id: inv6.id }, // iPad Air
    data: { reservedQuantity: { increment: 1 } },
  });

  // SO-0007: Smart Electronics - Dell & Lenovo (HOLD, reserved)
  // Current stock: IdeaPad=6, Dell Inspiron=7
  const so7 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0007',
      orderDate: new Date('2026-02-14'),
      customerId: customers[3].id,
      expectedDelivery: new Date('2026-02-28'),
      status: 'HOLD',
      subtotal: 263330,
      discountAmount: 0,
      taxAmount: 47399,
      totalAmount: 310729,
      createdBy: salesman.id,
      notes: 'Pending customer confirmation on quantities',
      items: {
        create: [
          {
            itemId: items[8].id, // IdeaPad - MRP 54999, 8% discount via rate sheet (Lenovo brand)
            quantity: 2,
            rate: 50599, // calculateInclusiveTaxRate(54999, 18, 8)
            discountPercent: 8,
            taxRate: 18,
            taxAmount: 15437,
            amount: 85761,
          },
          {
            itemId: items[10].id, // Dell Inspiron - MRP 59999, no discount (Dell not in Premium rate sheet inclusion)
            quantity: 3,
            rate: 59999, // MRP used since customer has rate sheet but Dell not in inclusion list
            discountPercent: 0,
            taxRate: 18,
            taxAmount: 27457,
            amount: 152540,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so7.id,
      fromStatus: null,
      toStatus: 'OPEN',
      reason: 'Order created',
      changedBy: salesman.id,
      changedAt: new Date('2026-02-14'),
    },
  });
  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so7.id,
      fromStatus: 'OPEN',
      toStatus: 'HOLD',
      reason: 'Customer requested hold - pending budget approval',
      changedBy: salesman.id,
      changedAt: new Date('2026-02-15'),
    },
  });

  // Reserve inventory for SO-0007
  await prisma.inventory.update({
    where: { id: inv9.id }, // IdeaPad
    data: { reservedQuantity: { increment: 2 } },
  });
  await prisma.inventory.update({
    where: { id: inv11.id }, // Dell Inspiron
    data: { reservedQuantity: { increment: 3 } },
  });

  // SO-0008: Digital World - Mixed order (OPEN, reserved) - tests FIFO priority
  // Created after SO-0005 for same items, so SO-0005 gets priority
  const so8 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-0008',
      orderDate: new Date('2026-02-16'),
      customerId: customers[1].id,
      expectedDelivery: new Date('2026-02-25'),
      status: 'OPEN',
      subtotal: 170198,
      discountAmount: 0,
      taxAmount: 30636,
      totalAmount: 200834,
      createdBy: salesman.id,
      notes: 'Urgent order for client demo',
      items: {
        create: [
          {
            itemId: items[1].id, // A54 - MRP 47999, 5% discount (standard rate, Samsung not excluded)
            quantity: 2,
            rate: 45599, // calculateInclusiveTaxRate(47999, 18, 5)
            discountPercent: 5,
            taxRate: 18,
            taxAmount: 13905,
            amount: 77293,
          },
          {
            itemId: items[8].id, // IdeaPad - MRP 54999, 5% discount (standard rate, Lenovo not excluded)
            quantity: 1,
            rate: 52249, // calculateInclusiveTaxRate(54999, 18, 5)
            discountPercent: 5,
            taxRate: 18,
            taxAmount: 7983,
            amount: 44266,
          },
        ],
      },
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      salesOrderId: so8.id,
      fromStatus: null,
      toStatus: 'OPEN',
      reason: 'Order created',
      changedBy: salesman.id,
      changedAt: new Date('2026-02-16'),
    },
  });

  // Reserve inventory for SO-0008
  await prisma.inventory.update({
    where: { id: inv2.id }, // A54 (already has 2 reserved from SO-0005, now +2 more)
    data: { reservedQuantity: { increment: 2 } },
  });
  await prisma.inventory.update({
    where: { id: inv9.id }, // IdeaPad (already has 2 reserved from SO-0007, now +1 more)
    data: { reservedQuantity: { increment: 1 } },
  });

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚙️  App Settings: 1 (Negative Billing)');
  console.log('👥 Users: 2');
  console.log('🏷️  Brands: 4 (with 9 sub-brands)');
  console.log('📦 Items: 11 (with inventory)');
  console.log('👤 Customers: 4');
  console.log('🏭 Vendors: 4');
  console.log('👨‍💼 Employees: 4');
  console.log('🏦 Bank Accounts: 3 (Cash + HDFC + ICICI)');
  console.log('💰 Rate Sheets: 2 (valid Jan-Jun 2026)');
  console.log('\n💼 Purchase Transactions:');
  console.log('  - Purchase Orders: 4 (All RECEIVED)');
  console.log('  - Purchase Invoices: 4');
  console.log('  - Vendor Payments: 3');
  console.log('  - Purchase Returns: 1');
  console.log('\n🛍️  Sales Transactions:');
  console.log('  - Sales Orders: 8 (3 fully invoiced, 1 partial, 3 OPEN, 1 HOLD)');
  console.log('  - Sales Invoices: 5');
  console.log('  - Payments Received: 4');
  console.log('  - Sales Returns: 1');
  console.log('\n📊 Stock Status (Physical / Reserved / Available):');
  console.log('  - Samsung S24 Ultra: 3 / 1 / 2  (SO-0005: 1 reserved)');
  console.log('  - Samsung A54:       5 / 4 / 1  (SO-0005: 2 + SO-0008: 2 reserved)');
  console.log('  - Samsung M34:       3 / 0 / 3');
  console.log('  - iPhone 15 Pro Max: 3 / 0 / 3');
  console.log('  - iPhone 14:         3 / 2 / 1  (SO-0006: 2 reserved)');
  console.log('  - iPad Air:          3 / 1 / 2  (SO-0006: 1 reserved)');
  console.log('  - MacBook Air:       1 / 0 / 1');
  console.log('  - ThinkPad X1:       2 / 0 / 2');
  console.log('  - IdeaPad Slim:      6 / 3 / 3  (SO-0007: 2 + SO-0008: 1 reserved)');
  console.log('  - Dell XPS:          1 / 0 / 1');
  console.log('  - Dell Inspiron:     7 / 3 / 4  (SO-0007: 3 reserved)');
  console.log('\n📋 Open Orders (ready for invoice creation):');
  console.log('  - SO-0005: Tech Solutions   (OPEN)  - 1x S24 Ultra, 2x A54');
  console.log('  - SO-0006: Retail Hub       (OPEN)  - 2x iPhone 14, 1x iPad Air');
  console.log('  - SO-0007: Smart Electronics (HOLD) - 2x IdeaPad, 3x Dell Inspiron');
  console.log('  - SO-0008: Digital World    (OPEN)  - 2x A54, 1x IdeaPad');
  console.log('\n💰 Rate Sheets (Active - Jan to Jun 2026):');
  console.log('  - Premium: Tech Solutions, Smart Electronics');
  console.log('    Inclusion model: Samsung 10%, Lenovo 8%, S24 Ultra 12%, ThinkPad 10%');
  console.log('  - Standard: Digital World, Retail Hub');
  console.log('    Exclusion model: 5% on all except Apple');
  console.log('\n🔧 Other:');
  console.log('  - Stock Adjustments: 1 (damage)');
  console.log('  - FIFO test: SO-0005 (Feb 10) has priority over SO-0008 (Feb 16) for A54');
  console.log('\n🔐 Test Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:    admin@example.com / password123    | Phone OTP: +918639347263');
  console.log('Salesman: salesman@example.com / password123 | Phone OTP: +919030437915');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
