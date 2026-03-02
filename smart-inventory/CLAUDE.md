# Ledger - Smart Inventory

## Project
Next.js 15 App Router + Prisma ORM + MySQL (Railway/AWS RDS) + shadcn/ui + Tailwind CSS 4
**Note: Redis removed 2026-02-20** — OTP uses in-memory cache (`src/lib/cache.ts`). Run `npm uninstall ioredis` if not done.

## Commands
- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx prisma db push` — Push schema changes to DB
- `npx prisma generate` — Regenerate Prisma client
- `npx prisma migrate dev` — Create and run migrations
- `npm run db:seed` — Seed database

## Structure
- `src/app/` — App Router pages and API routes
- `src/components/` — React components (organized by feature + ui/)
- `src/lib/` — Utilities, auth, business logic, PDF generation
- `src/hooks/` — Custom React hooks
- `src/types/` — TypeScript type definitions
- `src/generated/prisma/` — Generated Prisma client (DO NOT edit)
- `prisma/schema.prisma` — Database schema

## Key Patterns
- Use SWR for all client-side data fetching
- Use shadcn/ui components from `src/components/ui/`
- API routes use `checkPermission()` / `checkAuth()` from `src/lib/api-auth.ts` — all 86 routes are protected
- Business logic lives in `src/lib/` (invoice-utils, fifo-utils, etc.)
- Path alias: `@/*` maps to `./src/*`
- Shared company settings fetch: `fetchCompanySettings()` from `src/lib/export-utils.ts`
- Activation/deactivation: customers use `status` enum, vendors/items use `isActive` boolean
- All master APIs support `?activeOnly=true` to filter active records only

## Rules
- Do NOT run bash commands — tell the user what to run instead
- Do NOT edit `.env` files — they contain production secrets
- Do NOT edit files in `src/generated/` — they are auto-generated
- Do NOT edit `node_modules/` or lock files

## RBAC System (implemented 2026-03-02)
- **All 86 API routes protected** with `checkPermission()` or `checkAuth()` from `src/lib/api-auth.ts`
- `/api/test-prisma` deleted
- Custom roles with granular view/edit permissions per page — `src/types/permissions.ts`
- Middleware enforces page-level access from JWT — `src/middleware.ts`
- Role management UI at `/masters/roles`

## ⚠ SECURITY — Remaining Items

### HIGH
1. Negative invoice amounts allowed — no validation of quantity/rate in sales-invoices handlers.
2. Financial fields accept negative values — `creditLimit`, `openingBalance` (customer), `mrp`, `sellingPrice` (item) PUT handlers.
3. No login rate limiting in `src/lib/auth.ts`.

### MEDIUM
4. Invoice number race condition — use DB transaction lock in `generateInvoiceNumber()`.
5. `console.error` logs full Prisma error objects — may leak DB details in production.
