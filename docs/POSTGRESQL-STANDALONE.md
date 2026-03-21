# 🐘 ThreatIntel — Standalone PostgreSQL Setup (No Supabase)

Run ThreatIntel with a **plain PostgreSQL** database + **PostgREST** instead of the full Supabase stack. Zero code changes required.

---

## Quick Start (5 minutes)

### Prerequisites

- Docker ≥ 20.10 and Docker Compose ≥ 2.0
- 1 GB+ RAM

### Step 1 — Clone and configure

```bash
git clone <YOUR_REPO_URL> threatintel
cd threatintel

cp .env.docker.example .env.docker
```

Edit `.env.docker`:

```env
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=$(openssl rand -base64 32)
```

### Step 2 — Generate your anon JWT token

You need a JWT token signed with your `JWT_SECRET` for the frontend to authenticate with PostgREST.

**Option A — Using Node.js (easiest):**

```bash
node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({role:'anon',iss:'supabase',iat:1700000000,exp:2000000000})).toString('base64url');
const sig = crypto.createHmac('sha256','YOUR_JWT_SECRET').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
"
```

Replace `YOUR_JWT_SECRET` with your actual secret. Copy the output token.

**Option B — Using [jwt.io](https://jwt.io):**

1. Go to https://jwt.io
2. Set payload: `{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}`
3. Set the secret to your `JWT_SECRET`
4. Copy the encoded token

Add the token to `.env.docker`:

```env
VITE_SUPABASE_ANON_KEY=<paste-token-here>
```

### Step 3 — Start with the standalone compose file

```bash
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d
```

### Step 4 — Access

| Service       | URL                     |
|---------------|-------------------------|
| **Dashboard** | http://localhost:8080    |
| **REST API**  | http://localhost:3000    |
| **Database**  | localhost:5432           |
| **Nmap API**  | http://localhost:3001    |
| **Tools API** | http://localhost:3002    |

### Step 5 — Create your admin user

Since there's no GoTrue auth server in standalone mode, you need to create a user manually:

```bash
docker compose -f docker-compose.standalone.yml exec postgres psql -U postgres -d threatintel -c "
INSERT INTO profiles (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@local', 'Admin');

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin');
"
```

> **Note**: Without GoTrue, the built-in login page won't work. You'll need to either:
> 1. Add GoTrue standalone (see [Full Auth Setup](#option-a--add-gotrue-standalone) below)
> 2. Bypass auth in the frontend for local/internal use
> 3. Use a reverse proxy with your own auth (SSO, OIDC, etc.)

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  PostgREST   │────▶│  PostgreSQL  │
│  (Nginx:80)  │     │  (REST API)  │     │   :5432      │
│  :8080       │     │   :3000      │     └──────────────┘
└──────────────┘     └──────────────┘
                     
┌──────────────┐     ┌──────────────┐
│  Nmap Server │     │ Tools Server │
│  :3001       │     │  :3002       │
└──────────────┘     └──────────────┘
```

Compared to the full Supabase stack, this removes: Kong (API gateway), GoTrue (auth), Realtime (WebSocket), and Supabase Studio.

---

## What the init.sql Does

The `docker/db/init.sql` script automatically creates:

- **22 tables**: profiles, user_roles, app_settings, feed_sources, alert_rules, scans, scan_results, scan_schedules, scheduled_jobs, shodan_queries, shodan_results, email_log, ticket_log, ticket_history, audit_log, watchlist, top_cves, generated_reports, ai_prompts, ai_prompt_versions
- **PostgREST roles**: `anon`, `authenticated`, `authenticator` with proper grants
- **Functions**: `update_updated_at_column()`, `has_role()`
- **Triggers**: auto-update `updated_at` on 10 tables
- **Seed data**: default app settings and integration config

---

## Adding Authentication

### Option A — Add GoTrue Standalone

The easiest way to get full auth working is to add GoTrue as a single extra container:

```yaml
# Add to docker-compose.standalone.yml
  auth:
    image: supabase/gotrue:v2.164.0
    restart: unless-stopped
    ports:
      - "9999:9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/threatintel
      GOTRUE_SITE_URL: http://localhost:8080
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      API_EXTERNAL_URL: http://localhost:9999
    depends_on:
      postgres:
        condition: service_healthy
```

Then configure your frontend to point auth at `http://localhost:9999`.

### Option B — External Identity Provider

Use Keycloak, Auth0, Authentik, or your org's SSO. Modify `src/hooks/useAuth.ts` to use your provider's SDK.

### Option C — Bypass Auth (Internal/Dev Only)

For development or internal networks, you can disable auth checks. **Not recommended for production.**

---

## Edge Functions

The 16 Supabase edge functions need alternatives in standalone mode. Options:

### Option 1 — Convert to Express Routes (Recommended)

Create a single Node.js server that replaces all edge functions:

```bash
cd local-tools-server
# Edge functions become plugins — drop .js files in plugins/
```

The `local-tools-server` already supports a plugin architecture. Each edge function can be converted to a plugin:

| Function | Conversion Difficulty | Notes |
|----------|----------------------|-------|
| `rss-proxy` | Easy | Simple HTTP proxy |
| `cve-proxy` | Easy | Simple HTTP proxy |
| `shodan-proxy` | Easy | Simple HTTP proxy |
| `ransomlook-proxy` | Easy | Simple HTTP proxy |
| `test-connection` | Easy | Health check |
| `generate-command` | Easy | AI call |
| `send-email` | Medium | SMTP via nodemailer |
| `analyze-feed` | Medium | AI call + formatting |
| `analyze-scan` | Medium | AI call + formatting |
| `port-scan` | Medium | Shell exec to nmap |
| `generate-scan-report` | Medium | HTML templating |
| `defender-proxy` | Medium | OAuth2 token flow |
| `servicenow-ticket` | Medium | REST API call |
| `servicenow-sync` | Medium | REST API call |
| `watchlist-check` | Medium | DB query + API call |
| `alert-scan` | Hard | RSS fetch + rule matching + email |

### Option 2 — Keep Using Deno

Run the edge functions with Deno directly:

```bash
deno run --allow-net --allow-env supabase/functions/rss-proxy/index.ts
```

---

## File Storage

The app uses a storage bucket (`org-assets`) for organization logos. Alternatives:

- **Local filesystem**: Mount a volume at `/uploads/` and serve via Nginx
- **S3-compatible**: MinIO, AWS S3, Cloudflare R2
- **Skip it**: Store logo URLs directly in `app_settings` instead of uploading

---

## Operations

```bash
# Start
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d

# Stop
docker compose -f docker-compose.standalone.yml down

# View logs
docker compose -f docker-compose.standalone.yml logs -f

# Backup database
docker compose -f docker-compose.standalone.yml exec postgres \
  pg_dump -U postgres threatintel > backup.sql

# Restore database
cat backup.sql | docker compose -f docker-compose.standalone.yml exec -T postgres \
  psql -U postgres threatintel

# Full reset (⚠️ destroys data)
docker compose -f docker-compose.standalone.yml down -v
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `connection refused` on REST API | Wait for postgres healthcheck: `docker compose logs postgres` |
| `FATAL: role "authenticator" does not exist` | The init.sql should create it; if upgrading, run roles SQL manually (see init.sql) |
| Frontend blank page | Verify `VITE_SUPABASE_URL=http://localhost:3000` points to PostgREST |
| Auth not working | Standalone mode has no auth by default; add GoTrue or bypass |
| `permission denied` for nmap | Ensure `cap_add: NET_RAW, NET_ADMIN` on nmap-server |
| JWT errors | Verify `JWT_SECRET` matches between PostgREST and your anon token |
| Missing tables | Re-run init.sql: `docker compose exec postgres psql -U postgres -d threatintel -f /docker-entrypoint-initdb.d/01-init.sql` |

---

## Comparison

| Component | Supabase Stack | Standalone PostgreSQL |
|-----------|---------------|----------------------|
| Containers | 7 (postgres, kong, auth, rest, realtime, nmap, tools) | 4 (postgres, postgrest, nmap, tools) |
| Database | Supabase Postgres | Plain PostgreSQL 15 |
| REST API | PostgREST via Kong | PostgREST direct |
| Auth | GoTrue (built-in) | Optional (GoTrue/SSO/none) |
| Realtime | Supabase Realtime | Not included (polling works) |
| Storage | Supabase Storage | Local/S3/MinIO |
| Edge Functions | Deno (Supabase) | Express plugins or Deno |
| Frontend changes | None | None (with PostgREST) |
| RAM usage | ~1.5 GB | ~500 MB |
