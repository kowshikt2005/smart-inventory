# AWS Infrastructure & Server Configuration

> **GITIGNORED** — Do not commit. Contains server paths and config details.
> Last updated: 2026-04-01

---

## EC2 Instance

| Property | Value |
|---|---|
| OS | Ubuntu (latest LTS) |
| Private IP | 172.31.64.163 |
| Region | us-east-1 |
| SSH user | `ubuntu` |
| SSH command | `ssh -i your-key.pem ubuntu@<elastic-ip>` |

### Elastic IP
- One Elastic IP associated with the instance
- Points to both `mysbe.in` and `dev.mysbe.in` (same IP, nginx routes by hostname)

---

## RDS (MySQL)

| Property | Value |
|---|---|
| Engine | MySQL |
| Host | `database-1.c0jkyyac2jpz.us-east-1.rds.amazonaws.com` |
| Port | `3306` |
| Username | `admin` |
| Production DB | *(see .env)* |
| Dev DB | `smart_dev` |

### Connect to RDS from EC2
```bash
mysql -h database-1.c0jkyyac2jpz.us-east-1.rds.amazonaws.com -P 3306 -u admin -p
```

> Note: `-P` (uppercase) for port, `-h` for hostname only — do NOT append `:3306` to the hostname.

---

## Directory Structure on EC2

```
/home/ubuntu/
├── smart-inventory/                  # Production repo
│   └── smart-inventory/              # Next.js app (runs on port 3000)
│       ├── .env                      # Production env vars
│       └── ...
├── smart-inventory-dev/              # Dev repo
│   └── smart-inventory/              # Next.js app (runs on port 3001)
│       ├── .env                      # Dev env vars (NEXTAUTH_URL=https://dev.mysbe.in, DB=smart_dev)
│       └── ...
└── deploy-dev.sh                     # Dev deploy script
```

---

## PM2 Processes

| PM2 Name | Port | Directory | Domain |
|---|---|---|---|
| `smart-inventory` | 3000 | `~/smart-inventory/smart-inventory` | mysbe.in |
| `dev` | 3001 | `~/smart-inventory-dev/smart-inventory` | dev.mysbe.in |
| `stock-scan` | — | — | — |

### Useful PM2 commands
```bash
pm2 list                          # Show all running processes
pm2 restart smart-inventory       # Restart production
pm2 restart dev                   # Restart dev
pm2 logs dev                      # Tail dev logs
pm2 logs smart-inventory          # Tail prod logs
pm2 save                          # Save process list (survives reboot)
pm2 startup                       # Generate systemd startup script
```

---

## Nginx

### Config file locations
```
/etc/nginx/
├── nginx.conf                        # Main config
├── sites-available/
│   ├── default                       # Default (leave untouched)
│   ├── mysbe.in                      # Production config (managed by Certbot)
│   └── dev.mysbe.in                  # Dev config (manual)
└── sites-enabled/
    ├── default -> ../sites-available/default
    ├── mysbe.in -> ../sites-available/mysbe.in
    └── dev.mysbe.in -> ../sites-available/dev.mysbe.in
```

> Symlinks in `sites-enabled` activate a config. Always create them with:
> ```bash
> cd /etc/nginx/sites-enabled
> sudo ln -s /etc/nginx/sites-available/<filename>
> ```

### Production config (`/etc/nginx/sites-available/mysbe.in`)
```nginx
server {
    server_name mysbe.in www.mysbe.in;
    server_tokens off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header X-Powered-By;
    }

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/mysbe.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mysbe.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.mysbe.in) { return 301 https://$host$request_uri; }
    if ($host = mysbe.in)     { return 301 https://$host$request_uri; }
    listen 80;
    server_name mysbe.in www.mysbe.in;
    return 404;
}
```

### Dev config (`/etc/nginx/sites-available/dev.mysbe.in`)
```nginx
server {
    server_name dev.mysbe.in;
    server_tokens off;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header X-Powered-By;
    }

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/dev.mysbe.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dev.mysbe.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = dev.mysbe.in) { return 301 https://$host$request_uri; }
    listen 80;
    server_name dev.mysbe.in;
    return 404;
}
```

### Nginx management commands
```bash
sudo nginx -t                     # Test config syntax before reloading
sudo systemctl reload nginx       # Reload config (no downtime)
sudo systemctl restart nginx      # Full restart (brief downtime)
sudo systemctl status nginx       # Check if nginx is running
sudo tail -f /var/log/nginx/error.log    # Watch error logs
sudo tail -f /var/log/nginx/access.log  # Watch access logs
```

---

## SSL Certificates (Let's Encrypt / Certbot)

| Domain | Cert path | Expires |
|---|---|---|
| `mysbe.in` | `/etc/letsencrypt/live/mysbe.in/` | Auto-renews |
| `dev.mysbe.in` | `/etc/letsencrypt/live/dev.mysbe.in/` | 2026-06-30 |

### Certbot commands
```bash
# Obtain cert for a new subdomain (run AFTER nginx config + DNS is set up)
sudo certbot --nginx -d <subdomain.mysbe.in>

# If nginx config doesn't exist yet, obtain cert only
sudo certbot certonly --nginx -d <subdomain.mysbe.in>

# Install an already-obtained cert into an existing nginx config
sudo certbot install --cert-name <subdomain.mysbe.in>

# Check renewal status
sudo certbot renew --dry-run

# List all certs
sudo certbot certificates
```

> **Important**: DNS record must exist and propagate before running Certbot.
> Verify with: `nslookup <subdomain.mysbe.in>` — must return the Elastic IP.

---

## Deployment Workflow

### Deploy to dev
```bash
# On the server
~/deploy-dev.sh
```

Contents of `~/deploy-dev.sh`:
```bash
#!/bin/bash
cd ~/smart-inventory-dev/smart-inventory
git pull origin dev
npm install
npm run build
pm2 restart dev
echo "Dev deployed successfully"
```

### Deploy to production
```bash
cd ~/smart-inventory/smart-inventory
git pull origin main
npm install
npm run build
pm2 restart smart-inventory
```

### Run Prisma migrations (after schema changes)
```bash
# Dev
cd ~/smart-inventory-dev/smart-inventory && npx prisma db push

# Production
cd ~/smart-inventory/smart-inventory && npx prisma db push
```

---

## DNS Records (Route 53 or DNS provider)

| Name | Type | Value |
|---|---|---|
| `mysbe.in` | A | `<Elastic IP>` |
| `www.mysbe.in` | A | `<Elastic IP>` |
| `dev.mysbe.in` | A | `<Elastic IP>` |

---

## Dev Environment Indicator

The app shows a floating amber `DEV` badge (bottom-left) on `dev.mysbe.in`.
Controlled by `NEXT_PUBLIC_APP_ENV=development` in `/apps/dev/.env`.
Component: `src/components/DevBadge.tsx`.
Do NOT set this variable in the production `.env`.
