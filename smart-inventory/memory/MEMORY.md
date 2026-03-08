# Smart Inventory Project Memory

## Project Stack
- Next.js 15 App Router + Prisma ORM + MySQL + shadcn/ui + Tailwind CSS 4
- Path alias: `@/*` → `./src/*`
- Rules: No bash commands, no .env edits, no src/generated/ edits

## Key Architectural Decisions

### Reference IDs (added 2026-03-05)
- SalesOrder has `referenceNumber String?` — shown as "Reference" column in /sales/orders
- PurchaseOrder has `referenceNumber String?` — added 2026-03-05, shown as "Reference" column in /purchases/orders
- SalesInvoice has `orderNumber String?` — shown as "Order #" column in /sales/invoices (serves as reference)
- PurchaseInvoice shows linked PO's orderNumber as "Reference (PO#)" in /purchases/invoices

### Reorders → Reports (moved 2026-03-05)
- Reorders moved from /purchases/reorders → /reports/reorders
- Old pages still exist at /purchases/reorders (not deleted, just unused)
- New pages: /reports/reorders/page.tsx and /reports/reorders/[id]/page.tsx
- Sidebar: Reorders removed from Purchases section, added under Analytics alongside Reports
- Reports hub (/reports/page.tsx): Reorders card added at top
- Permissions: purchases_reorders permission still used for Reorders at new path
- PATH_TO_PERMISSION updated with /reports/reorders → purchases_reorders

## Permission System
- File: src/types/permissions.ts
- RBAC with view/edit per page, 86 protected API routes
- Sidebar uses canView() / canViewAny() from session.user.permissions
- PATH_TO_PERMISSION maps exact page paths to permission keys
- Dynamic paths (e.g. /reports/reorders/[id]) fall through middleware unchecked

## Import System
- src/lib/import-utils.ts — ENTITY_FIELDS defines importable fields per type
- src/app/api/import/execute/route.ts — handles validation + import
- Importable: CUSTOMER, VENDOR, ITEM, STOCK_JOURNAL, PAYMENT, VENDOR_PAYMENT, SALES_INVOICE, PURCHASE_INVOICE
- NOT importable: SALES_ORDER, PURCHASE_ORDER

## Schema Changes Requiring Migration
- After adding fields, run: `npx prisma db push` (then `npx prisma generate` if needed)
- 2026-03-05: Added PurchaseOrder.referenceNumber String?
