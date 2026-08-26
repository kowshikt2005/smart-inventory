# Ledger - Smart Inventory

## Project

Next.js 15 App Router + React 19 + TypeScript + Prisma 6 + MySQL + shadcn/ui + Tailwind CSS 4 + SWR.

The repository contains two application surfaces: the staff/admin application at `/` and the customer portal at `/portal`. Redis is not the active cache; OTP and other short-lived cache data use `src/lib/cache.ts`. The `ioredis` dependency and `src/lib/redis.ts` should be treated as legacy until explicitly removed.

## Commands

Run these from this directory:

- `npm run dev` - Start the Turbopack development server
- `npm run build` - Create a production build and generate PWA assets
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript without emitting files
- `npm run check` - Run typecheck and lint
- `npm run db:seed` - Seed the configured database with sample data
- `npx prisma db push` - Push the schema to the configured database
- `npx prisma generate` - Regenerate the Prisma client
- `npx prisma migrate dev` - Create and apply a development migration

Review the target `DATABASE_URL` before any database command. `db push`, migrations, reset, and seeding can change database state.

## Structure

- `src/app/` - App Router pages and API routes
- `src/components/` - Shared and feature-specific React components
- `src/lib/` - Authentication, authorization, business rules, reporting, PDF generation, imports, exports, and integrations
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript types and permission definitions
- `src/generated/prisma/` - Generated Prisma client; do not edit
- `prisma/schema.prisma` - Current database schema
- `scripts/` - Setup, import, PDF, stock-scan, and workflow utilities

## Key patterns

- Use SWR for client-side data fetching.
- Use shadcn/ui components from `src/components/ui/`.
- API handlers independently call `checkPermission()` / `checkAuth()` from `src/lib/api-auth.ts` or portal authentication. A current static scan found explicit checks in 122 of 129 route files; the remaining seven are login, logout, OTP, lockout-status, or other public authentication entry points.
- Business logic belongs in `src/lib/`, not in page components.
- `@/*` maps to `./src/*`.
- Use `fetchCompanySettings()` from `src/lib/export-utils.ts` for shared company settings.
- Customers use the `status` enum; vendors and items use `isActive`.
- Master APIs support `?activeOnly=true`.

## RBAC and authentication

- Staff use NextAuth JWT sessions with email/phone plus PIN and optional Google OAuth for existing users.
- Customers use a separate `portal-token` JWT and active-customer revalidation.
- Roles store JSON permissions with `view` and `edit` levels in `src/types/permissions.ts`.
- Middleware protects pages and portal APIs; route handlers repeat authorization checks as defense in depth.
- Role management is at `/masters/roles`.

## Business invariants

- `Inventory.physicalStock` is physical stock; `reservedQuantity` is stock committed to open/held sales orders.
- Sales orders reserve stock. Sales invoices consume physical stock and release reservations.
- Purchase invoices add stock. Sales and purchase returns create compensating stock and ledger entries.
- Number generators use MySQL named locks where needed.
- Sales pricing supports customer rate sheets and GST-inclusive calculations; purchase calculations are tax-exclusive.

## Rules

- Do not run bash commands; use PowerShell in this workspace.
- Do not edit `.env` files; they contain secrets.
- Do not edit `src/generated/`; regenerate the Prisma client instead.
- Do not edit `node_modules/` or lock files by hand.

## Known hardening work

- `/api/upload` validates the browser-provided MIME type; magic-byte validation would be stronger.
- Several older API error paths still return `error.message`; normalize these before production hardening is considered complete.
- Sales invoice schema fields support partial-invoicing concepts, but the current route rejects an order with an existing invoice and invoices the order as a whole. Treat partial invoicing as incomplete until the route and status transitions are aligned.
