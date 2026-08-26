# Smart Inventory Project Memory

**Last refreshed:** 2026-08-26

## Project

- Active application: `C:\Users\kowsh\Desktop\ledger\smart-inventory`
- Next.js 15 App Router, React 19, TypeScript, Prisma 6, MySQL
- Tailwind CSS 4, shadcn/ui, Radix UI, SWR
- Path alias: `@/*` -> `./src`
- Do not edit `.env`, `node_modules`, lock files, or `src/generated/prisma`

## Current scale

- 129 API route files
- 80 page files
- 82 shared component files
- 30 library modules
- 43 Prisma models and 15 Prisma enums
- No conventional automated test suite; current checks are TypeScript, ESLint, workflow scripts, and manual/browser testing

## Architecture

- Staff authentication: NextAuth JWT with email/phone plus PIN; Google OAuth is limited to existing users.
- Customer authentication: separate `portal-token` JWT with database status revalidation.
- Middleware protects admin pages, portal pages, and portal APIs.
- Route handlers independently enforce `checkPermission()` / `checkAuth()` or portal authentication.
- SWR is the standard client-side data-fetching layer.
- Business rules live in `src/lib/`.

## Domain rules

- Sales orders reserve inventory; sales invoices consume physical stock and release reservations.
- Purchase invoices add physical stock; returns reverse inventory and financial effects.
- Customer, vendor, and bank ledgers are updated with their corresponding financial transactions.
- Sales pricing uses customer rate sheets and GST-inclusive calculations; purchases use tax-exclusive calculations.
- FIFO helpers reconstruct stock cost and allocate payments.
- Stock scans create pending purchase reorders from allocation shortfalls.

## Portal

- `/portal` supports customer login, brand/item browsing, rate-sheet pricing, cart, order placement, and order history.
- The portal PWA is implemented: manifest, icons, offline page, service-worker generation, and `/portal/` scope are present.
- Portal inactivity logout is implemented through `src/components/portal/InactivityGuard.tsx`.

## Imports and integrations

Importable entities include customers, vendors, items, stock journals, payments, vendor payments, sales invoices, and purchase invoices. Integrations include GST portal helpers, WhatsApp, email, PDF/XLSX import/export, and invoice PDF generation.

## Known gaps

- Partial invoicing is represented in the schema but is not fully supported by the current sales-invoice route.
- Some API routes expose raw error messages.
- Upload validation trusts the browser MIME type rather than file signatures.
- `ioredis` and `src/lib/redis.ts` remain legacy-looking after the active cache moved in-memory.

## Current worktree

The branch is `main` and is aligned with `origin/main`. There are 18 uncommitted UI-only files changing table serial-number display and a purchase-return table colspan. These changes are user work and must not be reverted.

## Verification baseline

- `npm run typecheck`: passed on 2026-08-26
- `npm run lint`: passed with 0 errors and 210 warnings on 2026-08-26
