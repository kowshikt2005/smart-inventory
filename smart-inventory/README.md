# Smart Inventory

Smart Inventory is a GST-aware inventory, sales, purchasing, ledger, and customer-portal system for Indian wholesale businesses.

## What is implemented

### Internal application

- Dashboard, global search, notifications, and role-filtered navigation
- Customer, vendor, employee, item, brand, sub-brand, rate-sheet, role, and bank-account masters
- Sales orders, invoices, dummy invoices, receipts, and sales returns
- Purchase orders, purchase invoices, vendor payments, purchase returns, and reorders
- Stock reservations, stock journals, movement history, FIFO cost helpers, and stock scans
- Customer/vendor ledgers and bank ledgers
- Sales, purchase, profit, outstanding, closing, claim, and GST reports
- Excel/PDF import and export, invoice PDF generation, email, WhatsApp, and GST portal helpers

### Customer portal

The `/portal` application has separate customer authentication, brand/item browsing, customer-specific rate-sheet pricing, cart management, order placement, order history, inactivity logout, and installable PWA behavior. The PWA is scoped to `/portal/` so it does not cache or control the internal application.

## Architecture

```text
Next.js pages/components
        -> middleware authentication and page permissions
        -> API route handlers
        -> checkPermission/checkAuth or portal authentication
        -> business utilities in src/lib
        -> Prisma
        -> MySQL
```

The staff application uses NextAuth JWT sessions. The customer portal uses a separate `portal-token` JWT and rechecks that the customer is active. API handlers enforce authorization independently of the UI.

Inventory separates `physicalStock` from `reservedQuantity`. Sales orders reserve stock; sales invoices consume physical stock and release reservations; purchase invoices add stock; returns and stock journals create compensating movements. Customer, vendor, and bank ledger entries are created alongside the relevant financial transactions.

The current schema is in [`prisma/schema.prisma`](./prisma/schema.prisma). Business calculations and workflow rules are primarily in [`src/lib/`](./src/lib/), especially `order-utils.ts`, `purchase-utils.ts`, `stock-allocation.ts`, `fifo-utils.ts`, and `gst-report-utils.ts`.

## Development

Run commands from this directory:

```powershell
npm install
npm run dev
```

Checks:

```powershell
npm run typecheck
npm run lint
npm run check
```

`typecheck` runs TypeScript without emitting files. `lint` reports ESLint issues. `check` runs both. None of these commands changes the database.

Database setup and seed behavior are documented in [`SEEDING.md`](./SEEDING.md). Database schema commands can change shared database state, so review the target `DATABASE_URL` before using them.

## Current repository facts

- 129 API route files
- 80 page files
- 82 shared component files
- 43 Prisma models and 15 Prisma enums
- No conventional automated test suite; validation currently uses typecheck, lint, workflow scripts, and manual/browser checks

The source code, schema, and configuration are authoritative. Historical implementation plans and summaries that no longer describe current behavior have been removed.

## Project guidance

- [`CLAUDE.md`](./CLAUDE.md) - architecture and repository rules
- [`PORTAL-PWA-SPEC.md`](./PORTAL-PWA-SPEC.md) - current portal PWA behavior
- [`SEEDING.md`](./SEEDING.md) - database setup and sample data
- [`SEED_DATA_DATES.md`](./SEED_DATA_DATES.md) - seeded transaction dates
- [`AWS_INFRASTRUCTURE.md`](./AWS_INFRASTRUCTURE.md) - infrastructure notes
- [`EC2_DEPLOYMENT_PLAN.md`](./EC2_DEPLOYMENT_PLAN.md) - deployment preparation notes
