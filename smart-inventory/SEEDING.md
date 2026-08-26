# Database Seeding Guide

This guide is for a development or intentionally reset database. It does not contain production credentials. Keep secrets in `.env` and review `DATABASE_URL` before running database commands.

## New database

From `smart-inventory/`:

```powershell
npx prisma db push
npm run db:seed
```

`npx prisma db push` changes the configured database schema without creating a migration. `npm run db:seed` inserts sample records. Neither command changes application source files, but both change database state.

## Seeded data

The current seed script creates:

- System roles: ADMIN, SALESMAN, MANAGER, ACCOUNTANT, and BILLING_OPERATOR
- Two staff users: `admin@example.com` and `salesman@example.com`
- Brands, sub-brands, items, inventory, customers, vendors, employees, bank accounts, and rate sheets
- Sample sales, purchase, payment, return, ledger, and stock-journal records

The seeded staff users do not set the nullable `User.pin` field. Under the current employee authentication code, a null PIN uses the development default `123456`. Change or remove seeded credentials before using a shared or production database.

See [`SEED_DATA_DATES.md`](./SEED_DATA_DATES.md) for the sample transaction date ranges. The complete data definition is [`prisma/seed.ts`](./prisma/seed.ts).

## Other commands

```powershell
npx tsx prisma/seed.ts
npm run db:reset
npx prisma generate
```

`npx tsx prisma/seed.ts` runs the seed directly. `npm run db:reset` resets the Prisma database and then reseeds it; this deletes existing data and must not be used against a database that contains data to preserve. `npx prisma generate` regenerates the Prisma client and does not modify application source.

## Troubleshooting

- Missing tables: push the schema against the intended database, then seed.
- Prisma client mismatch: run `npx prisma generate`.
- Unique constraint errors: inspect the existing database before considering a reset.
- Seed behavior changes: edit `prisma/seed.ts`, then rerun the seed only against a disposable development database.
