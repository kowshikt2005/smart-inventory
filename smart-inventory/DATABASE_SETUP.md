# Database Setup Guide - Railway MySQL

This guide will help you set up a shared MySQL database on Railway for the smart-inventory project.

## Step 1: Create Railway Account & Project

1. Go to [Railway.app](https://railway.app/)
2. Sign up or log in (GitHub login recommended)
3. Click **"New Project"**
4. Select **"Deploy MySQL"**

## Step 2: Get Database Connection String

1. After MySQL is deployed, click on the **MySQL service** in your Railway dashboard
2. Go to the **"Variables"** tab
3. Look for the `DATABASE_URL` variable or construct it from individual variables:
   - `MYSQL_HOST`
   - `MYSQL_PORT`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`

4. The format will be:
   ```
   mysql://MYSQL_USER:MYSQL_PASSWORD@MYSQL_HOST:MYSQL_PORT/MYSQL_DATABASE
   ```

## Step 3: Configure Local Environment

1. Copy `.env.example` to `.env` in the `smart-inventory` directory:
   ```bash
   cd smart-inventory
   cp .env.example .env
   ```

2. Edit `.env` and paste your Railway database URL:
   ```env
   DATABASE_URL="mysql://root:your_password@containers-us-west-123.railway.app:1234/railway"
   ```

## Step 4: Share Database with Team

### Option A: Share the DATABASE_URL directly
- Copy the `DATABASE_URL` from Railway
- Share it with your team via secure channel (Slack, Discord, etc.)
- Each developer adds it to their local `.env` file
- **Note**: `.env` is gitignored, so it won't be committed

### Option B: Use Railway Team Features
- Invite team members to your Railway project
- They can access the database credentials directly from Railway dashboard

## Step 5: Define Your Database Schema

⚠️ **IMPORTANT: You need to define your database models!**

1. Open `prisma/schema.prisma`
2. Add your models below the TODO comment section
3. Example:
   ```prisma
   model Product {
     id          Int      @id @default(autoincrement())
     name        String
     sku         String   @unique
     price       Decimal  @db.Decimal(10, 2)
     quantity    Int
     categoryId  Int?
     category    Category? @relation(fields: [categoryId], references: [id])
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }

   model Category {
     id        Int       @id @default(autoincrement())
     name      String    @unique
     products  Product[]
     createdAt DateTime  @default(now())
   }
   ```

## Step 6: Run Database Migrations

After defining your schema, create and apply the migration:

```bash
cd smart-inventory

# Generate Prisma Client and create migration
npx prisma migrate dev --name init

# This will:
# 1. Create SQL migration files
# 2. Apply migrations to Railway database
# 3. Generate Prisma Client types
```

## Step 7: Using the Database in Your Code

Import and use the database client:

```typescript
import { db } from '@/lib/db'

// Example: Create a product
const product = await db.product.create({
  data: {
    name: 'Sample Product',
    sku: 'SKU-001',
    price: 99.99,
    quantity: 100
  }
})

// Example: Get all products
const products = await db.product.findMany()

// Example: Update a product
const updated = await db.product.update({
  where: { id: 1 },
  data: { quantity: 150 }
})
```

## Useful Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# View database in browser (Prisma Studio)
npx prisma studio

# Reset database (WARNING: deletes all data!)
npx prisma migrate reset

# Push schema changes without creating migration (for prototyping)
npx prisma db push
```

## Team Collaboration Workflow

1. **Define schema together**: Discuss and agree on database models
2. **One person creates migration**: Run `npx prisma migrate dev`
3. **Commit migration files**: Commit `prisma/migrations/` to git
4. **Team members pull changes**: After pulling, run:
   ```bash
   npx prisma migrate deploy  # Apply migrations
   npx prisma generate        # Generate client
   ```

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL is correct in `.env`
- Check Railway MySQL service is running
- Ensure your IP isn't blocked (Railway allows all IPs by default)

### Migration Errors
- Make sure DATABASE_URL is set before running migrations
- Check that no one else is running migrations simultaneously
- Review migration files in `prisma/migrations/`

### Type Errors
- Run `npx prisma generate` to regenerate types after schema changes
- Restart your IDE/TypeScript server

## Security Best Practices

1. **Never commit `.env`** - It's gitignored, but double-check
2. **Use strong passwords** - Railway generates these by default
3. **Rotate credentials** if exposed
4. **Limit database access** - Only share with authorized team members
5. **Backup regularly** - Railway provides automatic backups

## Railway Pricing

- Free tier: Suitable for development
- Shared database means cost-effective for teams
- Monitor usage in Railway dashboard

---

**Next Steps:**
1. ✅ You've set up the infrastructure
2. ⏳ Define your database schema in `prisma/schema.prisma`
3. ⏳ Run your first migration
4. ⏳ Start building features with type-safe database queries!
