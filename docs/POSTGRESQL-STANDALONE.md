# 🐘 ThreatIntel — Standalone PostgreSQL Setup (No Supabase)

This guide explains how to run ThreatIntel with a **plain PostgreSQL** database instead of Supabase. This removes the dependency on GoTrue (auth), PostgREST (REST API), Kong (gateway), and Realtime — you bring your own.

---

## When to Use This

- You have an existing PostgreSQL server and don't want Supabase
- You want full control over authentication and API layers
- You're integrating into an existing infrastructure with its own auth system
- You're deploying in an air-gapped or restricted environment

---

## Architecture Comparison

### Supabase Stack (Default)
```
Frontend → Kong Gateway → PostgREST → PostgreSQL
                        → GoTrue (Auth)
                        → Realtime (WebSocket)
```

### Standalone PostgreSQL
```
Frontend → Your API Layer (Express/Fastify/etc.) → PostgreSQL
         → Your Auth (Passport/JWT/OIDC/etc.)
```

---

## Step 1: Set Up PostgreSQL

### Option A: Docker

```bash
docker run -d \
  --name threatintel-db \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=threatintel \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15
```

### Option B: Existing PostgreSQL Server

Ensure you have PostgreSQL 14+ running and create a database:

```sql
CREATE DATABASE threatintel;
```

---

## Step 2: Initialize the Schema

Run the full schema initialization script:

```bash
psql -h localhost -U postgres -d threatintel -f docker/db/init.sql
```

This creates all 20 tables, enums, functions, and triggers.

### Tables Created

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles |
| `user_roles` | Role-based access (admin/user enum) |
| `app_settings` | JSON key-value configuration |
| `feed_sources` | RSS feed source definitions |
| `alert_rules` | Alert monitoring rule definitions |
| `scans` | Network scan records |
| `scan_results` | Per-host scan results |
| `scan_schedules` | Scheduled scan config |
| `scheduled_jobs` | Generic job scheduler |
| `shodan_queries` | Saved Shodan queries |
| `shodan_results` | Cached Shodan results |
| `email_log` | Email delivery history |
| `ticket_log` | ServiceDesk ticket records |
| `ticket_history` | Ticket status changes |
| `audit_log` | System audit trail |
| `watchlist` | RansomLook watchlist |
| `top_cves` | Tracked CVEs |
| `generated_reports` | Saved reports |
| `ai_prompts` | AI prompt templates |
| `ai_prompt_versions` | Prompt version history |

---

## Step 3: Replace the Supabase Client

The app uses the Supabase JS client (`@supabase/supabase-js`) for all database operations. To use plain PostgreSQL, you need to replace or adapt the client layer.

### Option A: Run PostgREST Standalone (Easiest)

PostgREST can run without the rest of the Supabase stack. It gives you a REST API that's compatible with the existing Supabase JS client.

```bash
docker run -d \
  --name threatintel-rest \
  -e PGRST_DB_URI=postgres://postgres:your_password@host.docker.internal:5432/threatintel \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=your-jwt-secret-min-32-chars \
  -p 3000:3000 \
  postgrest/postgrest:v12.2.3
```

Then create the required PostgreSQL roles:

```sql
-- Create roles that PostgREST expects
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN PASSWORD 'your_password';
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- Grant access to tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

Set your `.env`:
```env
VITE_SUPABASE_URL=http://localhost:3000
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-jwt-token
```

The existing codebase will work with no frontend code changes.

### Option B: Custom API Server (Full Control)

Build a Node.js/Express API that replaces PostgREST:

```bash
npm install express pg cors jsonwebtoken
```

```javascript
// api-server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const pool = new Pool({
  host: 'localhost',
  database: 'threatintel',
  user: 'postgres',
  password: 'your_password',
});

const app = express();
app.use(cors());
app.use(express.json());

// Example: GET /rest/v1/feed_sources
app.get('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  const allowedTables = [
    'feed_sources', 'alert_rules', 'app_settings', 'scans',
    'scan_results', 'scan_schedules', 'email_log', 'ticket_log',
    'audit_log', 'watchlist', 'shodan_queries', 'shodan_results',
    'top_cves', 'generated_reports', 'ai_prompts', 'ai_prompt_versions',
    'profiles', 'user_roles', 'scheduled_jobs', 'ticket_history'
  ];
  if (!allowedTables.includes(table)) return res.status(404).json({ error: 'Not found' });

  const result = await pool.query(`SELECT * FROM public.${table}`);
  res.json(result.rows);
});

app.listen(3000, () => console.log('API server on :3000'));
```

⚠️ **Note**: This approach requires modifying the frontend's Supabase client calls to use your custom API format, or building a PostgREST-compatible response format.

### Option C: Direct PostgreSQL from Edge/Serverless Functions

If you're deploying your own serverless functions (e.g., AWS Lambda, Cloudflare Workers), connect directly to PostgreSQL using `pg` or `postgres` npm packages instead of the Supabase client.

---

## Step 4: Replace Authentication

The app uses Supabase GoTrue for auth. Alternatives:

### Option A: GoTrue Standalone

```bash
docker run -d \
  --name threatintel-auth \
  -e GOTRUE_DB_DATABASE_URL=postgres://postgres:your_password@host.docker.internal:5432/threatintel \
  -e GOTRUE_JWT_SECRET=your-jwt-secret \
  -e GOTRUE_SITE_URL=http://localhost:8080 \
  -e API_EXTERNAL_URL=http://localhost:9999 \
  -p 9999:9999 \
  supabase/gotrue:v2.164.0
```

### Option B: Custom JWT Auth

Implement your own auth endpoints:

1. **Sign up**: Hash password with bcrypt, insert into `profiles` + `user_roles`
2. **Sign in**: Verify password, return a signed JWT
3. **Middleware**: Validate JWT on protected routes

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Sign up
app.post('/auth/v1/signup', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  // Insert into your users table + profiles
  const token = jwt.sign({ email, role: 'authenticated' }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ access_token: token });
});
```

### Option C: External Identity Provider

Use Keycloak, Auth0, or your organization's SSO. Modify `src/hooks/useAuth.ts` to use your provider's SDK instead of `supabase.auth`.

---

## Step 5: Handle Edge Functions

The 16 Supabase edge functions need to be converted to your preferred serverless platform or run as a standard Node.js server.

### Convert to Express Routes

```javascript
// Each edge function becomes an Express route
// Example: rss-proxy
app.post('/functions/v1/rss-proxy', async (req, res) => {
  const { url } = req.body;
  const response = await fetch(url);
  const text = await response.text();
  res.json({ data: text });
});
```

### Edge Functions to Convert

| Function | Purpose | Complexity |
|----------|---------|------------|
| `rss-proxy` | Fetch RSS feeds (CORS bypass) | Low |
| `cve-proxy` | CVE database queries | Low |
| `shodan-proxy` | Shodan API proxy | Low |
| `ransomlook-proxy` | RansomLook API proxy | Low |
| `defender-proxy` | Microsoft Defender API | Medium |
| `port-scan` | Network scanning | Medium |
| `send-email` | SMTP email sending | Medium |
| `analyze-feed` | AI analysis of feeds | Medium |
| `analyze-scan` | AI analysis of scans | Medium |
| `generate-command` | AI command generation | Low |
| `generate-scan-report` | HTML/PDF report creation | Medium |
| `alert-scan` | Automated alert scanning | High |
| `servicenow-ticket` | ServiceNow integration | Medium |
| `servicenow-sync` | ServiceNow sync | Medium |
| `test-connection` | Health check | Low |
| `watchlist-check` | Watchlist monitoring | Medium |

---

## Step 6: Storage

The app uses a Supabase storage bucket (`org-assets`, public) for organization logos. Replace with:

- **Local filesystem**: Serve from `/uploads/` directory
- **S3-compatible**: MinIO, AWS S3, Cloudflare R2
- **Direct URL**: Store logo URLs in `app_settings` instead of uploading

---

## Docker Compose (Minimal — PostgreSQL Only)

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: threatintel
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  postgrest:
    image: postgrest/postgrest:v12.2.3
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD:-changeme}@postgres:5432/threatintel
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token-with-at-least-32-characters}
    depends_on:
      postgres:
        condition: service_healthy

  nmap-server:
    build:
      context: ./local-nmap-server
      dockerfile: ../docker/nmap-server/Dockerfile
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      NMAP_API_KEY: ${NMAP_API_KEY:-}
    cap_add:
      - NET_RAW
      - NET_ADMIN

  tools-server:
    build:
      context: ./local-tools-server
      dockerfile: ../docker/tools-server/Dockerfile
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      PORT: 3002
      TOOLS_API_KEY: ${TOOLS_API_KEY:-}
    cap_add:
      - NET_RAW
      - NET_ADMIN

  frontend:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
      args:
        VITE_SUPABASE_URL: http://localhost:3000
        VITE_SUPABASE_PUBLISHABLE_KEY: ${ANON_JWT_TOKEN}
        VITE_LOCAL_NMAP_URL: http://localhost:3001
        VITE_LOCAL_TOOLS_URL: http://localhost:3002
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - postgrest

volumes:
  pgdata:
```

---

## Summary

| Component | Supabase | Standalone PostgreSQL |
|-----------|----------|----------------------|
| Database | Supabase Postgres | Plain PostgreSQL 14+ |
| REST API | PostgREST (via Kong) | PostgREST standalone or custom API |
| Auth | GoTrue | GoTrue standalone, custom JWT, or SSO |
| Realtime | Supabase Realtime | Not required (polling works) |
| Storage | Supabase Storage | S3/MinIO/local filesystem |
| Edge Functions | Deno (Supabase) | Express routes or serverless functions |
| Frontend | No changes needed | Minimal changes if using PostgREST |
