# Smart Inventory & Business Management System

> A comprehensive, GST-compliant business management system for small to mid-sized businesses in India.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
# http://localhost:3000
```

## 📚 Important Files

- **[PRD.md](./PRD.md)** - Complete Product Requirements Document
- **[PROJECT_MEMORY.md](./PROJECT_MEMORY.md)** - Project context, decisions, and progress ⭐ **READ THIS FIRST!**

## 🏗️ Current Status

**Phase**: Initial Setup & UI Development
**Version**: 0.1.0
**Last Updated**: January 6, 2026

### ✅ Completed
- Next.js 15 + React 19 + TypeScript setup
- Tailwind CSS 4 + shadcn/ui components
- Dashboard UI with metric cards
- Sidebar navigation with Masters menu
- Layout components (Sidebar, Header, DashboardLayout)

### 🔄 In Progress
- None

### ⏳ Next Steps
1. Install SQL Server Express
2. Configure Prisma ORM
3. Create database schema
4. Build Customer management module

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript 5, Tailwind CSS 4
- **UI Components**: shadcn/ui, Radix UI, Lucide Icons
- **Database**: Microsoft SQL Server (not yet configured)
- **ORM**: Prisma (not yet configured)
- **Authentication**: None (Phase 1), NextAuth.js v5 (planned)

## 📖 Documentation

For complete project context, architecture, decisions, and progress, see:
👉 **[PROJECT_MEMORY.md](./PROJECT_MEMORY.md)**

## 🎯 Core Features (Planned)

### Phase 1: Core Operations
- ✅ Dashboard UI
- ⏳ Customer onboarding with GST validation
- ⏳ Sales order management (4-state workflow)
- ⏳ Virtual inventory counter system
- ⏳ Invoice generation
- ⏳ Payment processing

### Phase 2: Advanced Features
- Returns and adjustments
- Comprehensive reporting
- Bank reconciliation
- Advanced inventory features

## 🏛️ Architecture

```
smart-inventory/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── layout/       # Layout components (Sidebar, Header)
│   │   └── ui/           # shadcn/ui components
│   ├── lib/              # Utilities
│   └── types/            # TypeScript types (to be created)
├── prisma/               # Database schema (to be created)
├── PRD.md                # Product Requirements
├── PROJECT_MEMORY.md     # Project context & decisions
└── README.md             # This file
```

## 📝 Key Business Logic

### Virtual Inventory Counter
```
virtual_available = physical_stock - reserved_quantity
```

### Sales Order States
1. **OPEN** - Order created, stock reserved
2. **DELIVER** - Ready for fulfillment
3. **HOLD** - Paused (credit/approval issues)
4. **REJECT** - Cancelled

### Credit Validation
```
if (outstanding + order_amount) > credit_limit:
    status = HOLD
    requires_manager_approval = true
```

## 🔗 Navigation

- **Dashboard**: `/` - Main dashboard with metrics
- **Masters**: `/masters` - Master data overview
  - Customers: `/masters/customers` (to be created)
  - Vendors: `/masters/vendors` (to be created)
  - Employees: `/masters/employees` (to be created)
  - Rate Sheets: `/masters/rate-sheets` (to be created)
  - Items: `/masters/items` (to be created)
    - Brands: `/masters/items/brands` (to be created)
    - Sub-brands: `/masters/items/sub-brands` (to be created)

## 🎨 Design Reference

- **Primary**: OutputBooks (https://demo.outputbooks.com)
- **Secondary**: LedgerZen dashboard
- **Style**: Clean, minimal, professional

## ⚙️ Environment Variables (To Be Created)

```env
# Database
DATABASE_URL="sqlserver://localhost:1433;database=smart_inventory;..."

# Authentication (Phase 2)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# GST API (when available)
GST_API_KEY="your-api-key"
GST_API_URL="https://gst-api-url.com"
```

## 👥 Team

- **Developer**: Building with Claude Code
- **Business Owner**: Product vision and requirements

## 📄 License

Private project - All rights reserved

---

**For detailed project information, see [PROJECT_MEMORY.md](./PROJECT_MEMORY.md)**
