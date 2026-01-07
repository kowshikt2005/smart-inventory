# Smart Inventory - Developer Setup Guide

This guide provides step-by-step instructions for setting up the Smart Inventory application after cloning the repository.

## Prerequisites

Before starting, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Git**
- **MySQL database** (local or remote)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd smart-inventory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and configure your database connection:
   ```env
   DATABASE_URL="mysql://username:password@host:port/database_name"
   ```

   **Example configurations:**
   - **Railway MySQL**: `mysql://root:password@host:port/railway`

### 4. Database Setup
3. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

4. **Verify database connection**:
   ```bash
   npx prisma db pull
   ```
### 5. Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Local**: http://localhost:3000
- **Network**: http://your-ip:3000

If port 3000 is in use, Next.js will automatically use the next available port (e.g., 3001, 3002).

## Testing the Application

### 1. Test API Endpoints

**Get all customers:**
```bash
curl http://localhost:3000/api/customers
```

**Create a new customer:**
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "gstin": "123456789012345",
    "state": "Maharashtra",
    "stateCode": "MH",
    "city": "Mumbai",
    "addressLine1": "123 Test Street",
    "openingAsOfDate": "2024-01-01T00:00:00.000Z"
  }'
```

### 2. Test Database Connection

Run this command to test direct database connectivity:
```bash
npx prisma studio
```

This opens Prisma Studio at http://localhost:5555 where you can view and manage your data.

### 3. Access the Web Interface

1. Open your browser and go to http://localhost:3000
2. Navigate through the application:
   - Dashboard
   - Customer management
   - Inventory features

## Common Issues & Solutions

### Issue: Module not found errors
**Solution**: Ensure all dependencies are installed and Prisma client is generated:
```bash
npm install
npx prisma generate
```

### Issue: Database connection errors
**Solution**: 
1. Verify your `DATABASE_URL` in `.env`
2. Ensure your database server is running
3. Check network connectivity to remote databases

### Issue: Migration errors
**Solution**: Reset the database and run migrations again:
```bash
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Issue: Port already in use
**Solution**: Either:
- Stop the process using the port
- Use a different port: `npm run dev -- -p 3001`
- Let Next.js auto-assign a port (it will show the actual port in console)

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open database GUI |
| `npx prisma migrate dev` | Create and apply migration |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma db push` | Push schema changes without migration |

## Project Structure

```
smart-inventory/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── api/            # API routes
│   │   ├── dashboard/      # Dashboard pages
│   │   └── masters/        # Master data pages
│   ├── components/         # React components
│   ├── lib/               # Utility libraries
│   └── generated/         # Generated Prisma client
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── public/                # Static assets
└── .env                   # Environment variables
```

## Database Schema

The application uses the following main models:
- **Customer**: Customer information with GST details
- Additional models will be added as development progresses

## Support

If you encounter any issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure database connectivity
4. Check that all dependencies are installed

For database-related issues, use Prisma Studio to inspect your data and verify the schema matches your expectations.