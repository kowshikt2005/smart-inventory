# EC2 Deployment Preparation Plan

## Overview
Prepare the smart-inventory Next.js application for deployment to AWS EC2 with Railway-hosted MySQL database.

## Current State
- **Application**: Next.js 15 + React 19 + TypeScript
- **Database**: MySQL on Railway (already configured)
- **Auth**: NextAuth.js v5 with JWT
- **ORM**: Prisma 6.19
- **Deployment Method**: Manual zip upload (initially), PM2 later

---

## Task 1: Fix .env.example (SECURITY FIX)

**File**: `smart-inventory/.env.example`

**Problem**: Contains actual Railway credentials and secrets!

**Current (INSECURE):**
```env
DATABASE_URL="mysql://root:IkNJTm...actual-password...@gondola.proxy.rlwy.net:55232/railway"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="630ddcd45de...actual-secret..."
```

**After (SECURE):**
```env
# Database - Railway MySQL
DATABASE_URL="mysql://user:password@host:port/database"

# NextAuth.js Configuration
NEXTAUTH_URL="http://your-ec2-public-ip:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

---

## Task 2: Update .gitignore

**File**: `smart-inventory/.gitignore`

**Add these entries for EC2 deployment:**
```gitignore
# EC2/Server deployment
*.log
logs/
*.pid
ecosystem.config.js
.pm2/
*.crt
*.key
ssl/
*.zip
```

---

## EC2 Deployment Guide

### Prerequisites on EC2
1. **Ubuntu 22.04 LTS** (recommended)
2. **Node.js 20.x** (required for Next.js 15)
3. **Nginx** (reverse proxy)
4. **unzip** (for extracting uploaded files)

### Step 1: EC2 Instance Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx and unzip
sudo apt install -y nginx unzip

# Verify installations
node --version  # Should show v20.x
npm --version
```

### Step 2: Prepare Zip File (On Your Local Machine)

**What to include in zip:**
- All source code (`src/`, `prisma/`, `public/`)
- Config files (`package.json`, `next.config.ts`, `tsconfig.json`, etc.)
- `.env.example` (for reference)

**What NOT to include:**
- `node_modules/` (will npm install on server)
- `.next/` (will build on server)
- `.env` (create manually on server)
- `.git/` (optional, not needed for manual deploy)

### Step 3: Upload & Extract on EC2
```bash
# Create app directory
sudo mkdir -p /var/www/smart-inventory
sudo chown $USER:$USER /var/www/smart-inventory

# Upload zip via SCP (from your local machine)
scp -i your-key.pem smart-inventory.zip ubuntu@your-ec2-ip:/var/www/smart-inventory/

# On EC2: Extract
cd /var/www/smart-inventory
unzip smart-inventory.zip
```

### Step 4: Configure & Build
```bash
cd /var/www/smart-inventory

# Install dependencies
npm install

# Create .env file
nano .env
```

**Add to .env:**
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@gondola.proxy.rlwy.net:55232/railway"
NEXTAUTH_URL="http://YOUR_EC2_PUBLIC_IP:3000"
NEXTAUTH_SECRET="generate-new-secret-with-openssl-rand-base64-32"
```

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (if needed)
npx prisma migrate deploy

# Build the application
npm run build
```

### Step 5: Run the Application
```bash
# Start in foreground (for testing)
npm start

# OR run in background with nohup
nohup npm start > app.log 2>&1 &

# Check if running
curl http://localhost:3000
```

### Step 6: Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/smart-inventory
```

Add:
```nginx
server {
    listen 80;
    server_name _;  # Accepts any hostname (for IP access)

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/smart-inventory /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: AWS Security Group
Open these ports in EC2 Security Group:
- **22** (SSH)
- **80** (HTTP)
- **443** (HTTPS - for later when you add domain + SSL)

---

## Verification After Deployment

1. **Test locally on EC2**: `curl http://localhost:3000`
2. **Test via browser**: `http://YOUR_EC2_PUBLIC_IP`
3. **Check logs**: `tail -f app.log` (if using nohup)
4. **Test database connection**: Try logging in or viewing data

---

## Future Enhancements

### Add PM2 for Process Management
```bash
sudo npm install -g pm2
pm2 start npm --name "smart-inventory" -- start
pm2 save
pm2 startup
```

### Add SSL with Domain
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Update NEXTAUTH_URL
When you add a domain, update `.env`:
```env
NEXTAUTH_URL="https://your-domain.com"
```

---

## Implementation Checklist

- [ ] Fix `.env.example` - Remove real credentials
- [ ] Update `.gitignore` - Add EC2/deployment entries
