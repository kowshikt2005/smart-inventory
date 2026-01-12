# Authentication System Documentation

## Overview
The Smart Inventory system uses NextAuth.js for authentication with support for both credentials-based login and Google OAuth. The system implements role-based access control (RBAC) with 5 user roles.

## User Roles & Permissions

| Role | Sales | Ledger | Masters | Employees |
|------|-------|--------|---------|-----------|
| SALESMAN | ✅ | ❌ | ❌ | ❌ |
| BILLING_OPERATOR | ✅ | ✅ | ❌ | ❌ |
| ACCOUNTANT | ✅ | ✅ | ✅ | ❌ |
| MANAGER | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |

## Setup Instructions

### 1. Environment Variables
Add these variables to your `.env` file:

```env
# NextAuth.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 2. Database Migration
Run the Prisma migration to update the database schema:

```bash
npx prisma migrate dev
```

### 3. Seed Initial Admin User
Create the initial admin user:

```bash
npm run db:seed
```

**Default Admin Credentials:**
- Email: `admin@smartinventory.com`
- Password: `admin123`

⚠️ **IMPORTANT:** Change the admin password after first login!

### 4. Install Dependencies
Make sure all required packages are installed:

```bash
npm install
```

## Authentication Flow

### 1. Credentials Login
- Users can log in with email and password
- Passwords are hashed using bcryptjs with 12 salt rounds
- Only active users can log in

### 2. Google OAuth
- Users must be created by admin first
- Google OAuth links to existing user accounts by email
- If no matching user exists, sign-in is rejected

### 3. Session Management
- JWT-based sessions
- Session includes user ID, email, name, and role
- Sessions persist across browser restarts

## Role-Based Access Control

### Navigation (Sidebar)
- Menu items are shown/hidden based on user role
- Employees menu only visible to MANAGER and ADMIN roles

### Page Protection
- `AuthGuard` component protects routes
- Redirects unauthenticated users to login
- Shows access denied for insufficient permissions

### API Protection
- Middleware protects API routes
- Employee management APIs require ADMIN role

## Key Components

### Authentication Components
- `AuthGuard` - Route protection wrapper
- `SessionProvider` - NextAuth session context
- `GoogleButton` - Google OAuth sign-in button

### Layout Components
- `Header` - User dropdown with logout
- `Sidebar` - Role-based navigation menu
- `DashboardLayout` - Main layout with auth guard

### Employee Management
- Only accessible to ADMIN users
- Create, edit, and manage user accounts
- Assign roles and permissions

## Security Features

1. **Password Security**
   - bcryptjs hashing with 12 salt rounds
   - Minimum 6 character requirement

2. **Session Security**
   - JWT tokens with secure secrets
   - Automatic session expiration

3. **Role-Based Access**
   - Server-side permission checks
   - Client-side UI restrictions

4. **Google OAuth Security**
   - Admin must pre-create accounts
   - Email verification required

## Usage Examples

### Protecting a Page
```tsx
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AdminPage() {
  return (
    <AuthGuard requiredRole={["ADMIN"]}>
      <div>Admin only content</div>
    </AuthGuard>
  );
}
```

### Checking User Role
```tsx
import { useSession } from "next-auth/react";

export function MyComponent() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  
  return (
    <div>
      {isAdmin && <AdminButton />}
    </div>
  );
}
```

### API Route Protection
```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Admin-only logic here
}
```

## Troubleshooting

### Common Issues

1. **"Invalid credentials" error**
   - Check email/password combination
   - Ensure user account is active

2. **Google OAuth fails**
   - Verify Google OAuth credentials in .env
   - Ensure user account exists with matching email

3. **Access denied errors**
   - Check user role permissions
   - Verify AuthGuard configuration

4. **Session not persisting**
   - Check NEXTAUTH_SECRET is set
   - Verify NEXTAUTH_URL matches your domain

### Reset Admin Password
If you forget the admin password, you can reset it via database:

```sql
-- Get the admin user ID
SELECT id FROM users WHERE email = 'admin@smartinventory.com';

-- Update with new hashed password (use bcryptjs to hash)
UPDATE users SET password = 'new_hashed_password' WHERE id = 'admin_user_id';
```

## Next Steps

1. Change default admin password
2. Configure Google OAuth (optional)
3. Create additional user accounts
4. Test role-based access control
5. Set up production environment variables