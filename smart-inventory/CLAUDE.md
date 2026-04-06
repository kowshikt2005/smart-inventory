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

### LOW
1. MIME type spoofing in `/api/upload` — validates `file.type` (client header), not magic bytes. Low risk since filenames are UUID-based.
2. Pre-existing routes (outside recent commits) still expose `error.message` to clients — see `Grep` for `error\.message` pattern in `src/app/api`.

### FIXED (2026-03-25)
- ~~Negative invoice amounts~~ — rate/quantity validation added to direct invoice and invoice PUT handlers.
- ~~Financial fields accept negative values~~ — customer and item PUT handlers now reject negative `creditLimit`, `openingBalance`, `mrp`, `sellingPrice`, `purchasePrice`.
- ~~No login rate limiting~~ — 5-attempt lockout (15 min) added for credentials and phone OTP in `src/lib/auth.ts`.
- ~~Invoice number race condition~~ — MySQL `GET_LOCK()` in `src/lib/invoice-utils.ts`.
- ~~`Math.random()` for OTP~~ — replaced with `crypto.randomInt()` in `src/lib/otp.ts`.
- ~~Error message leakage~~ — import, invoice, and email routes now return generic messages.
- ~~WhatsApp batch abuse~~ — 100-customer limit on `/api/whatsapp/send-outstanding`.
- ~~Header injection in gstin-lookup~~ — `captchaCookie` sanitized.
- ~~PDF parse DoS~~ — 20MB file size limit on `/api/import/parse-pdf`.
- ~~Email open relay~~ — 20-recipient cap + format validation on `/api/reports/send-email`.
