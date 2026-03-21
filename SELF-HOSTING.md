# 🐳 ThreatIntel — Self-Hosting Guide

Deploy ThreatIntel on your own infrastructure with Docker Compose. All data stays on your network.

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Kong (API)  │────▶│  PostgREST   │
│  (Nginx:80)  │     │   Gateway    │     │  (REST API)  │
│  :8080       │     │   :54321     │     └──────┬───────┘
└──────────────┘     │              │────▶│  GoTrue Auth │
                     │              │     │  (Auth API)  │
                     └──────────────┘     └──────┬───────┘
                                                 │
┌──────────────┐     ┌──────────────┐     ┌──────┴───────┐
│  Nmap Server │     │ Tools Server │     │  PostgreSQL  │
│  :3001       │     │  :3002       │     │  :54322      │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 20.10
- [Docker Compose](https://docs.docker.com/compose/install/) ≥ 2.0
- 2 GB+ RAM recommended

---

## Quick Start

### 1. Configure Environment

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` — at minimum change:
- `POSTGRES_PASSWORD` — strong database password
- `JWT_SECRET` — min 32 chars, generate with `openssl rand -base64 32`
- `VITE_SUPABASE_ANON_KEY` — JWT signed with your `JWT_SECRET` (role=anon)

### 2. Generate Supabase Keys

```bash
# Install jwt-cli or use https://supabase.com/docs/guides/self-hosting#api-keys
# Anon key (public, limited access):
echo '{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}' | jwt encode --secret "YOUR_JWT_SECRET"

# Service role key (admin, keep private):
echo '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}' | jwt encode --secret "YOUR_JWT_SECRET"
```

### 3. Start Everything

```bash
docker compose --env-file .env.docker up -d
# Or use the Makefile:
make up
```

### 4. Access

| Service          | URL                        |
|------------------|----------------------------|
| **Dashboard**    | http://localhost:8080       |
| **API Gateway**  | http://localhost:54321      |
| **Database**     | localhost:54322 (postgres)  |
| **Nmap Server**  | http://localhost:3001       |
| **Tools Server** | http://localhost:3002       |

### 5. Create First Admin User

Sign up through the UI at http://localhost:8080. The first user is automatically assigned the `admin` role via a database trigger.

---

## Services

### PostgreSQL (`supabase/postgres:15.6.1.143`)
- Full schema auto-initialized on first boot via `docker/db/init.sql`
- Data persisted in Docker volume `pgdata`
- Connect directly: `psql postgres://postgres:YOUR_PASSWORD@localhost:54322/postgres`
- Tables: profiles, user_roles, feed_sources, alert_rules, scans, scan_results, scan_schedules, app_settings, email_log, ticket_log, audit_log, watchlist, shodan_queries, shodan_results, top_cves, generated_reports, ai_prompts, ai_prompt_versions, scheduled_jobs, ticket_history

### Kong API Gateway (`kong:2.8.1`)
- Routes: `/rest/v1/` → PostgREST, `/auth/v1/` → GoTrue, `/realtime/v1/` → Realtime
- Declarative config: `docker/kong/kong.yml`
- CORS plugin enabled on all routes

### GoTrue Auth (`supabase/gotrue:v2.164.0`)
- Email/password authentication
- JWT-based sessions
- Auto-confirm configurable via `GOTRUE_MAILER_AUTOCONFIRM`

### PostgREST (`postgrest/postgrest:v12.2.3`)
- Auto-generated REST API from the PostgreSQL schema
- Schemas: `public`, `storage`

### Realtime (`supabase/realtime:v2.33.58`)
- WebSocket-based real-time subscriptions
- Postgres CDC (Change Data Capture)

### Nmap Server
- Runs real Nmap binary inside the container
- Has `NET_RAW` + `NET_ADMIN` capabilities for OS detection & SYN scans
- API: `http://localhost:3001/api/health`
- See [local-nmap-server/README.md](./local-nmap-server/README.md)

### Tools Server
- Plugin-based architecture — drop `.js` files in `plugins/` to add tools
- Nmap plugin included by default
- API: `http://localhost:3002/api/tools`
- See [local-tools-server/README.md](./local-tools-server/README.md)

### Frontend
- Built with Vite 5, served by Nginx
- SPA routing configured (all routes → index.html)
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- Gzip compression enabled
- 30-day cache for static assets

---

## Operations

### Makefile Commands

```bash
make help        # Show all commands
make up          # Start all services
make down        # Stop all services
make logs        # Tail all logs
make restart     # Restart all services
make rebuild     # Force rebuild and start
make backup-db   # Dump database to backup.sql
make restore-db  # Restore from backup.sql
```

### Manual Commands

```bash
# View logs
docker compose logs -f                # All services
docker compose logs -f nmap-server    # Specific service

# Restart a service
docker compose restart nmap-server

# Backup database
docker compose exec postgres pg_dump -U postgres postgres > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U postgres postgres

# Update / Rebuild
git pull
docker compose --env-file .env.docker up -d --build

# Full Reset (⚠️ destroys data)
docker compose down -v
docker compose --env-file .env.docker up -d
```

---

## Email Configuration (Optional)

To enable email verification and password reset, configure SMTP in `.env.docker`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_ADMIN_EMAIL=your-email@gmail.com
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833).

Without SMTP, set `GOTRUE_MAILER_AUTOCONFIRM=true` in `docker-compose.yml` to skip email verification.

---

## RSS Feed Auto-Refresh

The dashboard automatically fetches RSS feeds at a configurable interval.

### Configuration

1. Navigate to **Settings → General** in the UI
2. Set the **RSS Fetch Interval** using a cron expression:
   - `*/5 * * * *` — every 5 minutes
   - `*/30 * * * *` — every 30 minutes (recommended)
   - `0 * * * *` — every hour
3. Click **Save Settings**

The interval is stored in `app_settings` (key: `general`). The dashboard reads it and starts a client-side timer while the tab is open.

---

## Alert Monitoring Auto-Scan

Automated alert scanning runs on a configurable schedule and sends email notifications when rules match.

### Configuration

1. Navigate to **Settings → Notifications**
2. Enable **Automated Alert Scan Schedule**
3. Set the scan interval (cron expression or preset)
4. Add **Alert Email Recipients** (comma-separated)
5. Save settings

The alert scan edge function (`alert-scan`) fetches all active feeds, matches content against your alert rules, and sends emails using the configured Alert Template.

---

## Standalone PostgreSQL (Lighter Alternative)

If you want to run ThreatIntel **without the full Supabase stack** (no Kong, no GoTrue, no Realtime), use the standalone compose file:

```bash
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d
```

This runs only 4 containers (PostgreSQL + PostgREST + Nmap + Tools) and uses ~500 MB RAM vs ~1.5 GB for the full stack.

See **[docs/POSTGRESQL-STANDALONE.md](./docs/POSTGRESQL-STANDALONE.md)** for the complete guide including auth setup options.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `nmap: permission denied` | Ensure `cap_add: NET_RAW, NET_ADMIN` in docker-compose |
| Auth not working | Verify `JWT_SECRET` matches across all services |
| Database connection refused | Wait for postgres healthcheck: `docker compose logs postgres` |
| Frontend shows blank page | Check build args: `VITE_SUPABASE_URL` must be accessible from browser |
| Port conflict | Change host ports in `docker-compose.yml` (e.g., `9080:80`) |
| Email not sending | Verify SMTP settings in Settings → Integrations; check email_log table |
| Alert scan not running | Check Settings → Notifications for schedule config; verify SMTP is configured |

---

## Security Notes

- Change all default passwords before exposing to a network
- Use a reverse proxy (Caddy/Nginx) with TLS for production
- Set `NMAP_API_KEY` and `TOOLS_API_KEY` to restrict server access
- Consider network policies to isolate the Nmap container
- First user gets admin role automatically; subsequent users get `user` role
- RLS policies protect all database tables
