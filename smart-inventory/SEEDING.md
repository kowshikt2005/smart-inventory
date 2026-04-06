# Database Seeding Guide

## Quick Start

After updating your Railway database URL in `.env`, run these commands from the `smart-inventory` directory:

```bash
# Push schema to new database
npx prisma db push

# Seed the database with sample data
npm run db:seed
```

## What Gets Seeded

### 1. **Users** (2 users)
- **Admin**: `admin@example.com` / `password123`
- **Salesman**: `salesman@example.com` / `password123`

### 2. **Brands & Sub-brands** (3 brands, 6 sub-brands)
- Samsung (Galaxy S Series, Galaxy A Series)
- Apple (iPhone, iPad)
- Lenovo (ThinkPad, IdeaPad)

### 3. **Items with Inventory** (6 items)
- Samsung Galaxy S24 Ultra (15 in stock)
- Samsung Galaxy A54 5G (25 in stock)
- iPhone 15 Pro Max (8 in stock)
- iPad Air M2 (12 in stock)
- Lenovo ThinkPad X1 Carbon (10 in stock)
- Lenovo IdeaPad Slim 3 (20 in stock)

### 4. **Customers** (3 customers)
- Tech Solutions Pvt Ltd (Mumbai)
- Digital World Enterprises (Bangalore)
- Retail Hub (Chennai)

### 5. **Vendors** (3 vendors)
- Samsung India Electronics
- Apple Authorized Distributor
- Lenovo Distribution Ltd

### 6. **Employees** (3 employees)
- Rajesh Kumar - Sales Manager
- Priya Sharma - Accountant
- Amit Patel - Warehouse Manager

### 7. **Bank Accounts** (2 accounts)
- HDFC Bank Current Account
- ICICI Bank Sales Collection Account

### 8. **Rate Sheets** (2 rate sheets)
- Premium Customer Rate (for Tech Solutions)
- Standard Rate (for other customers)

### 9. **Sample Transactions**
- 2 Sales Orders
- 2 Sales Invoices (1 partial paid, 1 fully paid)
- 2 Payments
- 2 Purchase Orders
- 1 Purchase Invoice
- 1 Vendor Payment
- 1 Sales Return
- 1 Purchase Return
- Customer & Vendor Ledger Entries

## Alternative Commands

```bash
# Run seed directly with tsx
npx tsx prisma/seed.ts

# Reset database and re-seed (⚠️ WARNING: Deletes all data)
npm run db:reset

# Just seed without reset
npm run db:seed
```

## Test the Seeded Data

1. **Login**: Use `admin@example.com` / `password123`
2. **Browse Items**: Check inventory levels
3. **View Customers**: See outstanding balances
4. **Review Orders**: Explore sales orders and their statuses
5. **Check Invoices**: View paid/partial/pending invoices
6. **Payments**: See payment allocations
7. **Reports**: Test sales and purchase registers

## Customizing Seed Data

Edit `prisma/seed.ts` to:
- Add more items or brands
- Change customer details
- Adjust inventory quantities
- Modify pricing or GST rates
- Add more transactions

After editing, simply run `npm run db:seed` again.

## Troubleshooting

**Error: Table doesn't exist**
```bash
# Make sure schema is pushed first
npx prisma db push
```

**Error: Unique constraint violation**
```bash
# Database might already have data. Reset it:
npm run db:reset
```

**Import errors**
```bash
# Make sure Prisma client is generated
npx prisma generate
```
