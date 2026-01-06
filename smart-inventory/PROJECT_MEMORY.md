# Smart Inventory & Business Management System - Project Memory

**Last Updated**: January 6, 2026
**Project Status**: Initial Setup & UI Development Phase
**Version**: 0.1.0

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Key Decisions](#key-decisions)
4. [Architecture](#architecture)
5. [Database Schema (Planned)](#database-schema-planned)
6. [Implementation Log](#implementation-log)
7. [Current Progress](#current-progress)
8. [Implementation Tasks (Detailed)](#implementation-tasks-detailed)
9. [Next Steps](#next-steps)
10. [Important Notes](#important-notes)

---

## 📖 Project Overview

### Purpose
A comprehensive, GST-compliant business management system for small to mid-sized businesses in India. The system handles:
- Customer onboarding with GST validation
- Sales order processing with 4-state workflow
- Real-time inventory management with virtual counter system
- Invoice generation and payment tracking
- Returns processing
- Business intelligence and reporting

### Target Users
- **Salesman**: Customer inquiries, quotations, order processing
- **Billing Operator**: Invoice generation, receipts, documentation
- **Accountant**: Payments, ledgers, bank reconciliation, financial reporting
- **Manager**: Approvals, reports, strategic decisions

### Core Business Logic

#### Virtual Inventory Counter System (CRITICAL!)
- **Two-tier inventory**: Physical Stock vs Virtual Available Stock
- **Formula**: `virtual_available = physical_stock - reserved_quantity`
- **On Sales Order (OPEN)**: Reserve stock, reduce virtual counter
- **On Invoice Creation**: Update physical stock, release reservation

#### Sales Order 4-State Workflow
1. **OPEN** - Order created, stock reserved
2. **DELIVER** - Ready for fulfillment
3. **HOLD** - Paused (credit issues, needs approval)
4. **REJECT** - Cancelled (release reservations)

#### Credit Validation
- Check credit limit + outstanding balance before order processing
- Failed validation → Auto-HOLD → Manager approval required

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** (App Router) - React framework with SSR
- **React 19** - Latest React with concurrent features
- **TypeScript 5** - Type safety (strict mode, no `any` types)
- **Tailwind CSS 4** - Utility-first CSS framework

### UI Components & Libraries
- **shadcn/ui** - Headless component library (installed)
- **Radix UI** - Primitive components (via shadcn)
- **Lucide React** - Icon library
- **React Hook Form + Zod** - Form handling and validation

### State Management
- **Zustand** - Client state (planned)
- **React Query / TanStack Query** - Server state (planned)

### Database & ORM
- **Microsoft SQL Server** - Primary database (NOT YET INSTALLED)
- **Prisma ORM** - Type-safe database client (NOT YET CONFIGURED)

### Authentication
- **NO AUTH FOR NOW** - Will be added in later phase
- Planned: NextAuth.js v5 with JWT

### External Integrations (Planned)
- **GST API** - Government GST validation (API applied for, not yet available)
- **Email Service** - Nodemailer/SendGrid (Phase 2)
- **PDF Generation** - @react-pdf/renderer (planned)

### Development Tools (Installed)
- ESLint + Prettier
- TypeScript compiler
- Next.js dev server with Turbopack

---

## 🎯 Key Decisions

### 1. Database Choice
- **Decision**: Use SQL Server Express (native installation)
- **Reasoning**: PRD requirement, supports stored procedures for complex business logic
- **Status**: NOT YET INSTALLED (user doesn't have SQL Server)

### 2. Authentication Strategy
- **Decision**: NO authentication in Phase 1
- **Reasoning**: Focus on core business logic first
- **Future**: Will add NextAuth.js v5 later

### 3. GST API Integration
- **Decision**: Skip mock service, integrate real API when available
- **Status**: User applied for API credentials, waiting for approval

### 4. Purchase Management
- **Decision**: EXCLUDED from Phase 1
- **Reasoning**: Faster initial delivery, focus on sales flow
- **Workaround**: Use manual Stock Journal entries (SJ-xxxx) for initial inventory

### 5. Docker vs Native SQL Server
- **Decision**: SQL Server Express (native installation)
- **Reasoning**: User prefers native installation, no Docker usage

### 6. UI Design Reference
- **Primary Reference**: OutputBooks demo (https://demo.outputbooks.com)
- **Secondary Reference**: LedgerZen dashboard design
- **Approach**: Clean, minimal design with shadcn/ui components

---

## 🏗️ Architecture

### Folder Structure
```
smart-inventory/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Dashboard (homepage)
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Alternative dashboard route
│   │   ├── masters/
│   │   │   ├── page.tsx              # Masters overview
│   │   │   ├── customers/            # (TO BE CREATED)
│   │   │   ├── vendors/              # (TO BE CREATED)
│   │   │   ├── employees/            # (TO BE CREATED)
│   │   │   ├── rate-sheets/          # (TO BE CREATED)
│   │   │   └── items/                # (TO BE CREATED)
│   │   │       ├── page.tsx          # Items list
│   │   │       ├── brands/           # (TO BE CREATED)
│   │   │       └── sub-brands/       # (TO BE CREATED)
│   │   ├── api/                      # (TO BE CREATED)
│   │   │   ├── customers/
│   │   │   ├── orders/
│   │   │   ├── inventory/
│   │   │   ├── invoices/
│   │   │   └── payments/
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # ✅ CREATED - White sidebar with navigation
│   │   │   ├── Header.tsx            # ✅ CREATED - Top navigation bar
│   │   │   └── DashboardLayout.tsx   # ✅ CREATED - Main layout wrapper
│   │   └── ui/                       # ✅ shadcn/ui components
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── table.tsx
│   │       ├── switch.tsx
│   │       ├── badge.tsx
│   │       ├── dropdown-menu.tsx
│   │       └── separator.tsx
│   ├── lib/
│   │   └── utils.ts                  # ✅ CREATED - Utility functions
│   ├── types/                        # (TO BE CREATED)
│   ├── hooks/                        # (TO BE CREATED)
│   └── services/                     # (TO BE CREATED)
│       ├── gst-api.ts
│       └── pdf-generator.ts
├── prisma/                           # (TO BE CREATED)
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
├── .env                              # (TO BE CREATED)
├── PRD.md                            # ✅ Product Requirements Document
├── PROJECT_MEMORY.md                 # ✅ THIS FILE
└── package.json
```

### Navigation Structure (Sidebar)

```
LedgerZen
├── Dashboard (/)
└── Masters
    ├── Customers (/masters/customers)
    ├── Vendors (/masters/vendors)
    ├── Employees (/masters/employees)
    ├── Rate Sheets (/masters/rate-sheets)
    └── Items (collapsible)
        ├── Brands (/masters/items/brands)
        ├── Sub-brands (/masters/items/sub-brands)
        └── Items (/masters/items)
```

### Current UI Design

#### Sidebar
- **Style**: White background with gray borders
- **Width**: 256px (fixed)
- **Logo**: LedgerZen with teal calculator icon
- **Active State**: Gray background highlight
- **User Profile**: At bottom with avatar

#### Dashboard (Homepage)
- **Title**: Dashboard
- **Date Range Selector**: Two buttons (preset selector + date range picker)
- **Metrics Grid**: 4 cards showing:
  1. Total Sales (₹0.00) - Blue
  2. Total Purchases (₹0.00) - Purple
  3. Total Expenses (₹0.00) - Orange
  4. Net Profit (₹0.00) - Green

---

## 🗄️ Database Schema (Planned)

### Core Tables (To Be Created with Prisma)

#### Users & Authentication
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  name        String
  role        Role     @default(SALESMAN)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Role {
  SALESMAN
  BILLING_OPERATOR
  ACCOUNTANT
  MANAGER
}
```

#### Customers
```prisma
model Customer {
  id              String   @id @default(uuid())
  customerNumber  String   @unique  // customer-xxxx format
  name            String
  gstin           String   @unique  // 15-digit GSTIN
  email           String
  phone           String
  address         String
  city            String
  state           String
  creditLimit     Decimal
  creditDays      Int
  openingBalance  Decimal  @default(0)
  status          CustomerStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String

  salesOrders     SalesOrder[]
  invoices        Invoice[]
  payments        Payment[]
  rateSheets      RateSheet[]
}

enum CustomerStatus {
  ACTIVE
  INACTIVE
}
```

#### Items/Products
```prisma
model Item {
  id              String   @id @default(uuid())
  itemCode        String   @unique
  name            String
  description     String?
  brandId         String?
  subBrandId      String?
  hsnCode         String
  gstRate         Decimal
  standardPrice   Decimal
  purchasePrice   Decimal
  minStock        Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  brand           Brand?   @relation(fields: [brandId], references: [id])
  subBrand        SubBrand? @relation(fields: [subBrandId], references: [id])
  inventory       Inventory[]
  salesOrderItems SalesOrderItem[]
}

model Brand {
  id        String   @id @default(uuid())
  name      String   @unique
  items     Item[]
  subBrands SubBrand[]
}

model SubBrand {
  id       String  @id @default(uuid())
  name     String
  brandId  String
  brand    Brand   @relation(fields: [brandId], references: [id])
  items    Item[]
}
```

#### Inventory (with Virtual Counter)
```prisma
model Inventory {
  id                String   @id @default(uuid())
  itemId            String   @unique
  physicalStock     Int      // Actual stock in warehouse
  reservedQuantity  Int      @default(0) // Reserved by sales orders
  virtualAvailable  Int      // physicalStock - reservedQuantity
  minStockLevel     Int
  lastUpdated       DateTime @updatedAt

  item              Item     @relation(fields: [itemId], references: [id])
  stockMovements    StockMovement[]
}
```

#### Sales Orders (4-State Workflow)
```prisma
model SalesOrder {
  id                 String          @id @default(uuid())
  orderNumber        String          @unique  // SO-xxxx format
  orderDate          DateTime
  customerId         String
  expectedDelivery   DateTime?
  referenceNumber    String?
  status             OrderStatus     @default(OPEN)
  subtotal           Decimal
  discountAmount     Decimal         @default(0)
  taxAmount          Decimal
  totalAmount        Decimal
  notes              String?
  terms              String?
  salesRepId         String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  createdBy          String

  customer           Customer        @relation(fields: [customerId], references: [id])
  items              SalesOrderItem[]
  invoice            Invoice?
  statusHistory      OrderStatusHistory[]
}

enum OrderStatus {
  OPEN
  DELIVER
  HOLD
  REJECT
  DELIVERED
}

model SalesOrderItem {
  id              String      @id @default(uuid())
  salesOrderId    String
  itemId          String
  quantity        Int
  rate            Decimal
  taxRate         Decimal
  taxAmount       Decimal
  amount          Decimal

  salesOrder      SalesOrder  @relation(fields: [salesOrderId], references: [id])
  item            Item        @relation(fields: [itemId], references: [id])
}

model OrderStatusHistory {
  id              String      @id @default(uuid())
  salesOrderId    String
  fromStatus      OrderStatus
  toStatus        OrderStatus
  reason          String?
  changedAt       DateTime    @default(now())
  changedBy       String

  salesOrder      SalesOrder  @relation(fields: [salesOrderId], references: [id])
}
```

#### Rate Sheets (Customer-specific Pricing)
```prisma
model RateSheet {
  id          String   @id @default(uuid())
  customerId  String
  itemId      String
  rate        Decimal
  discount    Decimal  @default(0)
  validFrom   DateTime
  validTo     DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  customer    Customer @relation(fields: [customerId], references: [id])
}
```

#### Stock Journals (Manual Adjustments)
```prisma
model StockJournal {
  id          String   @id @default(uuid())
  journalNumber String @unique  // SJ-xxxx format
  date        DateTime @default(now())
  itemId      String
  quantity    Int
  type        StockMovementType
  reason      String
  createdBy   String
  createdAt   DateTime @default(now())
}
```

---

## 📝 Implementation Log

### Session 1: January 6, 2026 - Project Setup & UI Development

#### What Was Built

##### 1. **Project Initialization**
```bash
# Created Next.js 15 project with TypeScript
npx create-next-app@latest smart-inventory

# Installed shadcn/ui
npx shadcn@latest init -d

# Installed UI components
npx shadcn@latest add button input dropdown-menu separator badge table switch
```

**Files Created**:
- `src/lib/utils.ts` - Utility functions
- `src/components/ui/*` - shadcn/ui components (7 components)
- `components.json` - shadcn/ui configuration

##### 2. **Layout System**
**Created comprehensive layout components**:

**`src/components/layout/Sidebar.tsx`**:
- White background with gray borders (matching LedgerZen design)
- Navigation structure:
  - Dashboard link (/)
  - Masters dropdown with:
    - Customers (/masters/customers)
    - Vendors (/masters/vendors)
    - Employees (/masters/employees)
    - Rate Sheets (/masters/rate-sheets)
    - Items (nested dropdown):
      - Brands (/masters/items/brands)
      - Sub-brands (/masters/items/sub-brands)
      - Items (/masters/items)
- LedgerZen logo with teal calculator icon
- User profile section at bottom
- Active state highlighting
- Collapsible dropdowns with smooth animations

**`src/components/layout/Header.tsx`**:
- Fixed header (left offset: 256px for sidebar)
- Search bar with icon
- Green "+" button
- Company name display ("Raga Bakery & Restaurant")
- User profile icons

**`src/components/layout/DashboardLayout.tsx`**:
- Wrapper component combining Sidebar + Header
- Main content area with proper margins (ml-64, pt-16)

##### 3. **Dashboard Page**
**`src/app/page.tsx`** - Homepage dashboard:
- Page title: "Dashboard"
- Date range selector (UI only):
  - "Select a preset" dropdown button
  - Calendar button showing "Jan 01, 2026 - Jan 31, 2026"
- 4 Metric cards grid (matching LedgerZen screenshot):
  1. **Total Sales** - ₹0.00 (Blue, DollarSign icon)
  2. **Total Purchases** - ₹0.00 (Purple, FileText icon)
  3. **Total Expenses** - ₹0.00 (Orange, CreditCard icon)
  4. **Net Profit** - ₹0.00 (Green, TrendingUp icon)
- Placeholder content area for charts/widgets
- "No data available" message

##### 4. **Masters Page**
**`src/app/masters/page.tsx`**:
- Overview page with card grid showing:
  - Customers (892 count)
  - Suppliers (156 count)
  - Items/Products (1240 count)
  - Rate Sheets (45 count)
  - Users & Roles (12 count)
  - Bank Accounts (5 count)
- Recent updates table
- Export and settings buttons

##### 5. **Configuration Updates**
**`src/app/globals.css`**:
- Removed `tw-animate-css` import (causing errors)
- Kept Tailwind CSS 4 imports
- shadcn/ui theme variables configured

#### Design Decisions Made

1. **Sidebar Style**: Changed from blue gradient to white/gray (LedgerZen style)
2. **Logo**: "LedgerZen" with teal calculator icon
3. **Navigation**: Hierarchical menu with collapsible dropdowns
4. **Dashboard Layout**: Metric cards in 4-column grid
5. **Color Scheme**:
   - Blue for sales metrics
   - Purple for purchases
   - Orange for expenses
   - Green for profit

#### Files Modified
- `src/app/page.tsx` - Replaced with dashboard
- `src/app/globals.css` - Removed tw-animate-css
- `README.md` - Updated with project information

#### Technical Challenges Resolved
1. **tw-animate-css error**: Removed problematic import
2. **Sidebar width**: Changed from 64px (icon-only) to 256px (full menu)
3. **Layout spacing**: Adjusted main content margins for sidebar/header

---

## ✅ Current Progress

### Completed (Phase 0 - UI Setup)

#### 1. Project Initialization ✅
- [x] Next.js 15 project created
- [x] TypeScript configured
- [x] Tailwind CSS 4 set up
- [x] shadcn/ui initialized and components installed

#### 2. Layout Components ✅
- [x] Sidebar component with navigation
  - Dashboard link
  - Masters dropdown (Customers, Vendors, Employees, Rate Sheets)
  - Items nested dropdown (Brands, Sub-brands, Items)
  - User profile section
- [x] Header component with search and company info
- [x] DashboardLayout wrapper component

#### 3. Pages Created ✅
- [x] Dashboard/Homepage (/)
  - 4 metric cards (Sales, Purchases, Expenses, Profit)
  - Date range selector UI
  - Placeholder for charts
- [x] Masters overview page (/masters)

#### 4. UI Components Installed ✅
- [x] Button
- [x] Input
- [x] Table
- [x] Switch
- [x] Badge
- [x] Dropdown Menu
- [x] Separator

#### 5. Design System ✅
- [x] White sidebar with gray borders (LedgerZen style)
- [x] Clean, professional UI matching reference designs
- [x] Responsive grid layouts
- [x] Hover effects and transitions

### Not Started

#### 1. Database Setup ❌
- [ ] Install SQL Server Express
- [ ] Configure Prisma ORM
- [ ] Create database schema
- [ ] Set up migrations
- [ ] Create seed data scripts

#### 2. API Routes ❌
- [ ] Customer CRUD endpoints
- [ ] Sales Order endpoints
- [ ] Inventory management endpoints
- [ ] Invoice generation endpoints
- [ ] Payment processing endpoints

#### 3. Business Logic ❌
- [ ] Virtual inventory counter system
- [ ] Credit validation logic
- [ ] 4-state order workflow
- [ ] GST calculations
- [ ] Rate sheet application logic

#### 4. Master Data Pages ❌
- [ ] Customers list and form
- [ ] Vendors list and form
- [ ] Employees list and form
- [ ] Rate Sheets management
- [ ] Items/Products management
- [ ] Brands management
- [ ] Sub-brands management

#### 5. Sales Module ❌
- [ ] Sales Order list page
- [ ] Sales Order creation form
- [ ] Sales Order state management
- [ ] Invoice generation
- [ ] Payment receipts

#### 6. External Integrations ❌
- [ ] GST API integration (waiting for credentials)
- [ ] Email service setup
- [ ] PDF generation for invoices

---

## 📋 Implementation Tasks (Detailed)

### Priority 0: Infrastructure Setup (REQUIRED FIRST)

#### Task 0.1: SQL Server Installation ⚡ CRITICAL
**Status**: Not Started
**Estimated Time**: 1 hour
**Dependencies**: None

**Steps**:
1. [ ] Download SQL Server Express 2022
   - URL: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
   - Select "Express" edition (free)
2. [ ] Run installer
   - Choose "Basic" installation
   - Accept license terms
   - Note down SA password (SAVE THIS!)
3. [ ] Install SQL Server Management Studio (SSMS)
   - Download from Microsoft
   - Install for database administration
4. [ ] Verify installation
   - Open SSMS
   - Connect to localhost
   - Test connection successful
5. [ ] Create database
   ```sql
   CREATE DATABASE smart_inventory;
   ```

**Deliverables**:
- SQL Server running on localhost:1433
- Database `smart_inventory` created
- SA credentials saved securely

---

#### Task 0.2: Prisma ORM Setup ⚡ CRITICAL
**Status**: Not Started
**Estimated Time**: 30 minutes
**Dependencies**: Task 0.1 (SQL Server installed)

**Steps**:
1. [ ] Install Prisma packages
   ```bash
   cd smart-inventory
   npm install prisma @prisma/client
   npx prisma init
   ```

2. [ ] Configure `.env` file
   ```env
   DATABASE_URL="sqlserver://localhost:1433;database=smart_inventory;user=sa;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true"
   ```

3. [ ] Update `prisma/schema.prisma`
   ```prisma
   datasource db {
     provider = "sqlserver"
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }
   ```

4. [ ] Create initial schema (copy from PROJECT_MEMORY.md)
   - User model
   - Customer model
   - Item model (basic version)
   - Inventory model

5. [ ] Run first migration
   ```bash
   npx prisma migrate dev --name init
   ```

6. [ ] Generate Prisma Client
   ```bash
   npx prisma generate
   ```

7. [ ] Test connection
   - Create `src/lib/prisma.ts`
   - Test database query

**Deliverables**:
- Prisma configured and connected
- Initial database schema migrated
- Prisma Client generated

---

### Priority 1: Master Data Management

#### Task 1.1: Customers Module 🎯 HIGH PRIORITY
**Status**: Not Started
**Estimated Time**: 4-6 hours
**Dependencies**: Task 0.2 (Prisma setup)

##### 1.1.1: Database Schema
- [ ] Ensure Customer model in Prisma schema
- [ ] Add indexes on gstin, phone, email
- [ ] Run migration

##### 1.1.2: API Routes
Create `/src/app/api/customers/route.ts`:
- [ ] GET /api/customers - List all customers (with pagination)
- [ ] POST /api/customers - Create new customer
- [ ] Validation with Zod schemas
- [ ] Error handling

Create `/src/app/api/customers/[id]/route.ts`:
- [ ] GET /api/customers/[id] - Get single customer
- [ ] PUT /api/customers/[id] - Update customer
- [ ] DELETE /api/customers/[id] - Soft delete customer

##### 1.1.3: Customer List Page
Create `/src/app/masters/customers/page.tsx`:
- [ ] Data table with columns:
  - Customer Number
  - Name
  - GSTIN
  - Phone
  - Email
  - Credit Limit
  - Outstanding Balance
  - Status
  - Actions
- [ ] Search functionality (name, GSTIN, phone)
- [ ] Filters (Active/Inactive, Credit exceeded)
- [ ] Pagination
- [ ] "New Customer" button
- [ ] Export to Excel/CSV button
- [ ] View/Edit/Delete actions

##### 1.1.4: Customer Form Component
Create `/src/components/forms/CustomerForm.tsx`:
- [ ] Form fields:
  - Name (required)
  - GSTIN (required, 15 digits, validation)
  - Phone (required)
  - Email (required, validation)
  - Address (multiline)
  - City
  - State
  - Credit Limit (number, default 0)
  - Credit Days (number, default 0)
  - Opening Balance (number, default 0)
  - Status (Active/Inactive)
- [ ] GST validation (format check)
- [ ] GST API integration (when available)
  - Auto-populate name, address from GSTIN
- [ ] Real-time validation with Zod
- [ ] Success/Error toast notifications
- [ ] Cancel button

##### 1.1.5: Customer Detail Page
Create `/src/app/masters/customers/[id]/page.tsx`:
- [ ] Customer information card
- [ ] Credit status summary
- [ ] Recent orders list
- [ ] Outstanding invoices
- [ ] Payment history
- [ ] Edit button
- [ ] Delete button (with confirmation)

**Deliverables**:
- Complete Customer CRUD operations
- Working customer list with search
- Customer form with validation
- Customer detail view

---

#### Task 1.2: Items/Products Module 🎯 HIGH PRIORITY
**Status**: Not Started
**Estimated Time**: 6-8 hours
**Dependencies**: Task 0.2 (Prisma setup)

##### 1.2.1: Brands Management
Create `/src/app/masters/items/brands/page.tsx`:
- [ ] Brand list table (Name, Items Count, Actions)
- [ ] Add brand modal/form
- [ ] Edit brand
- [ ] Delete brand (with validation - no items using it)

##### 1.2.2: Sub-brands Management
Create `/src/app/masters/items/sub-brands/page.tsx`:
- [ ] Sub-brand list table (Name, Brand, Items Count, Actions)
- [ ] Add sub-brand modal/form
- [ ] Parent brand selection
- [ ] Edit sub-brand
- [ ] Delete sub-brand

##### 1.2.3: Items Management
Create `/src/app/masters/items/page.tsx`:
- [ ] Items data table:
  - Item Code
  - Name
  - Brand
  - Sub-brand
  - HSN Code
  - GST Rate
  - Standard Price
  - Current Stock
  - Status
  - Actions
- [ ] Advanced search (code, name, brand)
- [ ] Filters (brand, sub-brand, low stock)
- [ ] Bulk import from Excel
- [ ] Export functionality

Create `/src/components/forms/ItemForm.tsx`:
- [ ] Form fields:
  - Item Code (auto-generated or manual)
  - Name (required)
  - Description
  - Brand (dropdown)
  - Sub-brand (dropdown, filtered by brand)
  - HSN Code (required)
  - GST Rate (dropdown: 0%, 5%, 12%, 18%, 28%)
  - Standard Price (required)
  - Purchase Price
  - Minimum Stock Level
  - Opening Stock
- [ ] Image upload (optional - Phase 2)
- [ ] Validation with Zod

**Deliverables**:
- Brands CRUD complete
- Sub-brands CRUD complete
- Items CRUD with brand relationships
- Item list with search and filters

---

#### Task 1.3: Vendors Module
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: Task 1.1 (similar to Customers)

**Steps**: (Similar to Customer module)
- [ ] Vendor database model
- [ ] API routes
- [ ] Vendor list page
- [ ] Vendor form
- [ ] Vendor detail page

**Fields**:
- Vendor Number
- Name
- GSTIN
- Contact Person
- Phone
- Email
- Address
- Payment Terms
- Status

---

#### Task 1.4: Employees Module
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: Task 0.2

**Steps**:
- [ ] Employee database model
- [ ] API routes
- [ ] Employee list page
- [ ] Employee form

**Fields**:
- Employee ID
- Name
- Email
- Phone
- Role (Salesman, Billing Operator, Accountant, Manager)
- Join Date
- Status

---

#### Task 1.5: Rate Sheets Module
**Status**: Not Started
**Estimated Time**: 4-5 hours
**Dependencies**: Task 1.1 (Customers), Task 1.2 (Items)

**Steps**:
- [ ] Rate Sheet database model
- [ ] API routes
- [ ] Rate Sheet list page (filter by customer)
- [ ] Rate Sheet form
  - Customer selection
  - Item selection (multi-select or table)
  - Custom rate per item
  - Discount percentage
  - Valid from/to dates
- [ ] Apply rate sheet logic in sales orders

---

### Priority 2: Inventory Management

#### Task 2.1: Stock Journal (Manual Adjustments)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: Task 1.2 (Items)

**Steps**:
- [ ] Stock Journal database model
- [ ] API routes
- [ ] Stock Journal list page
- [ ] Stock Journal form
  - Journal Number (auto-generated: SJ-xxxx)
  - Date
  - Item selection
  - Quantity (+/-)
  - Type (Opening Stock, Adjustment, Damage, etc.)
  - Reason
- [ ] Update inventory on journal creation
- [ ] Audit trail

**Deliverables**:
- Manual stock entry system
- Stock movement tracking

---

#### Task 2.2: Virtual Inventory Counter System ⚡ CRITICAL
**Status**: Not Started
**Estimated Time**: 4-6 hours
**Dependencies**: Task 1.2 (Items), Task 2.1 (Stock Journal)

**Steps**:
- [ ] Inventory model with fields:
  - physicalStock
  - reservedQuantity
  - virtualAvailable (computed)
- [ ] Helper functions:
  ```typescript
  function calculateVirtualAvailable(physicalStock, reservedQuantity)
  function reserveStock(itemId, quantity)
  function releaseStock(itemId, quantity)
  function updatePhysicalStock(itemId, quantity)
  ```
- [ ] Real-time stock check API
- [ ] Stock availability widget
- [ ] Low stock alerts

**Deliverables**:
- Virtual counter logic implemented
- Stock reservation system working
- Real-time stock checks

---

### Priority 3: Sales Order System

#### Task 3.1: Sales Order List Page
**Status**: Not Started
**Estimated Time**: 4-5 hours
**Dependencies**: Task 1.1 (Customers), Task 2.2 (Inventory)

**Steps**:
- [ ] Sales Order database model
- [ ] Sales Order Items model
- [ ] Order Status History model
- [ ] API routes for sales orders
- [ ] Sales Order list page (replica of OutputBooks)
  - Status filter tabs (Open, Delivered, Hold, Canceled)
  - Data table
  - Search and filters
  - "New Sales Order" button

---

#### Task 3.2: Sales Order Creation Form ⚡ CRITICAL
**Status**: Not Started
**Estimated Time**: 8-10 hours
**Dependencies**: Task 3.1

**Steps**:
- [ ] Sales Order form component
- [ ] Header section:
  - Order Number (auto-generated)
  - Order Date (default: today)
  - Customer selection (searchable dropdown)
  - Expected Delivery Date
  - Reference Number
- [ ] Line items table:
  - Item selection (searchable)
  - Quantity input
  - Rate (from rate sheet or standard price)
  - Tax calculation
  - Amount calculation
  - Add/Remove rows
- [ ] Calculations section:
  - Subtotal
  - Discount
  - Tax breakdown (CGST/SGST/IGST)
  - Round off
  - Total
- [ ] Additional fields:
  - Notes
  - Terms & Conditions
  - Sales Rep
- [ ] Stock availability check
- [ ] Credit validation
- [ ] Save as draft
- [ ] Submit order

**Complex Logic**:
1. On item selection:
   - Check virtual stock availability
   - Get customer-specific rate (if rate sheet exists)
   - Calculate taxes based on GST rate
2. On save:
   - Reserve stock (update virtual counter)
   - Check credit limit
   - If credit exceeded → Set status to HOLD
   - Create order record
   - Create order items
   - Log status history

---

#### Task 3.3: Order State Management Workflow
**Status**: Not Started
**Estimated Time**: 4-5 hours
**Dependencies**: Task 3.2

**Steps**:
- [ ] State transition functions:
  ```typescript
  function changeOrderStatus(orderId, newStatus, reason, userId)
  ```
- [ ] State change validations
- [ ] Virtual counter updates on state changes:
  - OPEN → REJECT: Release reservation
  - HOLD → REJECT: Release reservation
  - Any → DELIVERED: Update physical stock
- [ ] Manager approval workflow for HOLD orders
- [ ] Status history tracking
- [ ] Notifications (future)

---

#### Task 3.4: Credit Validation System
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: Task 1.1 (Customers), Task 3.2 (Sales Orders)

**Steps**:
- [ ] Calculate customer outstanding balance
  ```typescript
  function getOutstandingBalance(customerId)
  ```
- [ ] Credit validation function:
  ```typescript
  function validateCredit(customerId, orderAmount): {
    allowed: boolean,
    reason?: string,
    outstanding: number,
    limit: number
  }
  ```
- [ ] Integration in order creation
- [ ] Credit status display in customer detail
- [ ] Manager approval queue

---

### Priority 4: Invoice & Payment System

#### Task 4.1: Invoice Generation
**Status**: Not Started
**Estimated Time**: 6-8 hours
**Dependencies**: Task 3.2 (Sales Orders)

**Steps**:
- [ ] Invoice database model
- [ ] Invoice Items model
- [ ] API routes
- [ ] Create invoice from sales order
- [ ] Invoice template (HTML/CSS)
- [ ] PDF generation (using @react-pdf/renderer)
- [ ] GST-compliant invoice format:
  - Company GSTIN
  - Customer GSTIN
  - HSN codes
  - Tax breakdown
  - Invoice number
  - Date
  - Terms
- [ ] Automatic actions on invoice creation:
  - Change order status to DELIVERED
  - Update physical stock
  - Update virtual counter
  - Create accounting entries
  - Update customer ledger

---

#### Task 4.2: Payment Receipt
**Status**: Not Started
**Estimated Time**: 4-5 hours
**Dependencies**: Task 4.1 (Invoices)

**Steps**:
- [ ] Payment database model
- [ ] API routes
- [ ] Payment receipt form:
  - Receipt Number (auto-generated: RCP-xxxx)
  - Customer
  - Invoice selection (multi-select)
  - Amount
  - Payment Mode (Cash, Bank Transfer, Cheque, UPI)
  - Payment Date
  - Reference Number
  - Bank Account
- [ ] Update customer outstanding balance
- [ ] Payment allocation to invoices
- [ ] Receipt PDF generation

---

### Priority 5: Reporting & Dashboard

#### Task 5.1: Dashboard Metrics (Real Data)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: Task 4.1 (Invoices), Task 4.2 (Payments)

**Steps**:
- [ ] API endpoint for dashboard metrics
- [ ] Calculate real-time metrics:
  - Total Sales (current period)
  - Total Purchases (current period)
  - Total Expenses (current period)
  - Net Profit
- [ ] Date range filtering
- [ ] Update dashboard page with real data
- [ ] Charts (optional - Phase 2):
  - Sales trend
  - Top products
  - Top customers

---

### Priority 6: Additional Features

#### Task 6.1: GST API Integration
**Status**: Blocked (waiting for API credentials)
**Estimated Time**: 2-3 hours
**Dependencies**: API credentials from government

**Steps**:
- [ ] Create GST service: `src/services/gst-api.ts`
- [ ] GSTIN validation endpoint
- [ ] Fetch company details by GSTIN
- [ ] Auto-populate customer/vendor data
- [ ] Error handling for invalid GSTIN
- [ ] Rate limiting
- [ ] Cache results

---

#### Task 6.2: Bulk Import/Export
**Status**: Not Started
**Estimated Time**: 4-5 hours per module
**Dependencies**: Respective CRUD modules complete

**Steps**:
- [ ] Excel template creation
- [ ] CSV/Excel import functionality
  - Customers import
  - Items import
  - Opening stock import
- [ ] Data validation
- [ ] Bulk insert
- [ ] Export to Excel/CSV
  - Customers export
  - Items export
  - Inventory report
  - Sales report

---

#### Task 6.3: Search & Filters
**Status**: Not Started (part of each module)
**Estimated Time**: Included in module estimates

**Steps**:
- [ ] Global search component
- [ ] Advanced filters for each list page
- [ ] Date range filters
- [ ] Status filters
- [ ] Customer/vendor filters
- [ ] Search by multiple fields

---

### Priority 7: Testing & Quality Assurance

#### Task 7.1: Unit Tests
**Status**: Not Started
**Estimated Time**: Ongoing

**Steps**:
- [ ] Test utilities setup (Jest, React Testing Library)
- [ ] Test critical business logic:
  - Virtual counter calculations
  - Credit validation
  - Order state transitions
  - Tax calculations
- [ ] API route tests
- [ ] Component tests

---

#### Task 7.2: Integration Tests
**Status**: Not Started
**Estimated Time**: 3-4 hours

**Steps**:
- [ ] End-to-end test setup (Playwright)
- [ ] Test complete flows:
  - Create customer → Create order → Generate invoice → Record payment
  - Stock journal → Update inventory → Check availability
- [ ] Test error scenarios

---

### Summary of Tasks

**Total Estimated Time for Phase 1**: 60-80 hours

**Critical Path**:
1. SQL Server + Prisma setup (Priority 0) - 1.5 hours
2. Customers module (Priority 1.1) - 5 hours
3. Items module (Priority 1.2) - 7 hours
4. Virtual inventory (Priority 2.2) - 5 hours
5. Sales Orders (Priority 3) - 17 hours
6. Invoices (Priority 4.1) - 7 hours
7. Payments (Priority 4.2) - 5 hours

**Quick Wins** (Build these first):
- Stock Journal for manual entry
- Customers list & form
- Items/Brands management
- Dashboard with real metrics

---

## 🎯 Next Steps

### Immediate (Next Session)

1. **Install & Configure SQL Server**
   - Download SQL Server Express 2022
   - Install and configure
   - Create database: `smart_inventory`
   - Set up admin credentials

2. **Set Up Prisma ORM**
   ```bash
   npm install prisma @prisma/client
   npx prisma init
   ```
   - Configure connection string in `.env`
   - Create initial schema for core tables
   - Run first migration

3. **Create Environment Configuration**
   ```env
   DATABASE_URL="sqlserver://localhost:1433;database=smart_inventory;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### Phase 1: Core Features (Upcoming)

1. **Customer Management**
   - Create customer form with GST validation UI
   - Customer list with search and filters
   - Customer detail view
   - Credit limit configuration

2. **Items/Products Management**
   - Brands CRUD
   - Sub-brands CRUD
   - Items CRUD with pricing
   - Inventory tracking setup

3. **Sales Order System**
   - Order creation form
   - Order list with status filters
   - 4-state workflow implementation
   - Virtual inventory counter logic

4. **Invoice Generation**
   - Invoice creation from orders
   - PDF generation
   - Inventory update logic
   - Payment tracking

### Phase 2: Advanced Features (Future)

1. Returns and adjustments
2. Comprehensive reporting
3. Bank reconciliation
4. Advanced inventory features
5. GST API integration (when available)

---

## 📝 Important Notes

### Critical Business Rules

1. **Stock Reservation Logic**
   - When Sales Order status = OPEN: Reserve stock
   - Virtual counter MUST update in real-time
   - Cannot create order if virtual stock insufficient
   - Formula: `virtual_available = physical_stock - reserved_quantity`

2. **Credit Validation**
   - Check BEFORE order creation
   - If (outstanding + order_amount) > credit_limit → HOLD
   - Requires Manager approval to proceed

3. **Order Status Transitions**
   - OPEN → DELIVER: No virtual counter change
   - OPEN → HOLD: Maintain reservation
   - OPEN → REJECT: Release reservation, increase virtual counter
   - HOLD → OPEN: Maintain reservation
   - HOLD → REJECT: Release reservation
   - Any → DELIVERED (via Invoice): Update physical stock

4. **Invoice Creation Impact**
   - Auto-change order status to DELIVERED
   - Update physical stock: `physical_stock -= sold_quantity`
   - Update virtual counter: `virtual_available = physical_stock - remaining_reserved`
   - Create accounting entries
   - Update customer ledger

### GST Compliance Requirements

1. **Mandatory GSTIN Validation**
   - All customers must have valid 15-digit GSTIN
   - Format: 22AAAAA0000A1Z5
   - Auto-populate company details from GST database

2. **Invoice Requirements**
   - Proper GST invoice format
   - CGST/SGST/IGST breakdown
   - HSN codes for all items
   - Company GSTIN
   - Customer GSTIN

### Number Formats

- **Customers**: customer-xxxx (e.g., customer-0001)
- **Sales Orders**: SO-xxxx (e.g., SO-0001)
- **Invoices**: INV-xxxx (e.g., INV-0001)
- **Receipts**: RCP-xxxx (e.g., RCP-0001)
- **Stock Journals**: SJ-xxxx (e.g., SJ-0001)
- **Purchase Orders**: PO-xxxx (e.g., PO-0001) - Phase 2
- **GRN**: GRN-xxxx (e.g., GRN-0001) - Phase 2

### Performance Requirements (from PRD)

- Stock availability checks: < 2 seconds
- Credit validation: < 1 second
- Real-time inventory updates
- Support concurrent users

### Security Requirements

- Role-based access control (RBAC)
- Audit logs for critical operations
- Data encryption for sensitive info
- No file uploads in Phase 1

---

## 🔗 Key Resources

### Documentation
- **PRD**: `/smart-inventory/PRD.md`
- **Project Memory**: `/smart-inventory/PROJECT_MEMORY.md` (this file)

### Reference Applications
- **OutputBooks Demo**: https://demo.outputbooks.com/index.php/sales/order
  - Sales Order interface reference
  - Status tabs and workflow
  - Table design and filters

### External APIs
- **GST API**: Awaiting credentials from user
- **Email**: Not configured yet
- **SMS**: Not planned for Phase 1

### Development
- **Dev Server**: http://localhost:3000
- **Git Repository**: Local only (no remote yet)

---

## 🚀 Commands Reference

### Development
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database (When Configured)
```bash
# Create migration
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed
```

### Code Quality
```bash
# Run linter
npm run lint

# Format code
npm run format  # (if configured)
```

---

## 📊 Project Metrics

### Code Statistics (Estimated)
- **Total Files Created**: ~15
- **Components**: 3 layout, 6 UI components
- **Pages**: 3 (Dashboard, Masters overview, placeholder routes)
- **Lines of Code**: ~1,500 (mostly UI/layout)

### Dependencies
- **Total npm packages**: ~200 (including Next.js ecosystem)
- **Direct dependencies**: ~20
- **Key packages**:
  - next: 15.5.9
  - react: 19.x
  - typescript: 5.x
  - tailwindcss: 4.x
  - shadcn/ui components

---

## 🐛 Known Issues

1. **tw-animate-css warning**: Error in console but doesn't affect functionality
   - Already removed from imports
   - Cache issue, will resolve on clean rebuild

2. **No database connection**: Expected - SQL Server not yet installed

3. **Mock data only**: All metric cards show ₹0.00 - waiting for database

---

## 💡 Future Enhancements (Beyond Phase 1)

1. **Multi-branch Support**: Currently single branch only
2. **Multi-warehouse**: Currently single warehouse
3. **Purchase Management**: Full supplier and PO management
4. **Advanced BI**: Charts, graphs, predictive analytics
5. **Mobile App**: React Native companion app
6. **Barcode Scanning**: For inventory management
7. **WhatsApp Integration**: Order notifications
8. **Payment Gateway**: Razorpay/Stripe integration
9. **E-commerce Module**: Online store integration
10. **API Webhooks**: Third-party integrations

---

**End of Project Memory**

---

### How to Use This File

This file serves as the project's "brain" - a single source of truth for:
- ✅ Understanding project context quickly
- ✅ Remembering key decisions and why they were made
- ✅ Tracking progress and what's been completed
- ✅ Planning next steps
- ✅ Onboarding new developers or AI assistants
- ✅ Maintaining consistency across sessions

**Update this file whenever**:
- Major decisions are made
- New features are completed
- Architecture changes
- Important bugs are discovered
- Requirements change

---

*Last reviewed: January 6, 2026*
*Next review: After SQL Server setup and database schema creation*
