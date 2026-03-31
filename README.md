# 🛡️ ThreatIntel — Threat Intelligence Platform

A comprehensive **Threat Intelligence + Vulnerability Scanning + AI Advisory System** built with React, TypeScript, and Lovable Cloud.

---

## Overview

This platform aggregates, correlates, and analyzes security threat data from multiple sources, providing real-time monitoring, AI-powered analysis, network scanning, and enterprise-grade reporting capabilities.

### Core Purpose

- **Threat Intelligence Aggregation** — Ingest and correlate RSS feeds from trusted security sources (CISA, NVD, Krebs, Talos, etc.)
- **Vulnerability Scanning** — Real Nmap-based network scanning with port detection, banner grabbing, OS fingerprinting, and service identification
- **AI-Powered Analysis** — Automated threat analysis with risk scoring and remediation recommendations using configurable AI models
- **Enterprise Reporting** — Branded PDF/HTML/CSV reports with customizable advisory and alert templates
- **Automated Alerting** — Rule-based monitoring with scheduled scans and email notifications

---

## Key Features

### 📡 RSS Feed Management
- Add/edit/remove custom RSS feed sources with categories and tags
- Test feed URL connectivity before saving
- Enable/disable individual feeds
- Live feed ingestion with duplicate detection
- Configurable auto-refresh intervals (cron-based)

### 🔍 Threat Intelligence Dashboard
- Real-time aggregation of security articles from configured feeds
- Top CVE tracking panel (High & Critical severity)
- Search, filter by source, and severity filtering
- Click-through to AI-powered feed analysis
- Pagination with configurable page size

### 🧠 AI Analysis Engine
- One-click AI analysis of any feed item
- Executive summary, technical findings, risk assessment
- Remediation recommendations with priority levels
- Export as Markdown, email, or ServiceDesk ticket
- Configurable AI model selection (Gemini, GPT-5 family)
- Customizable AI prompts with version history
- Advisory template with live preview and variable substitution

### 🌐 Network Scanner
- **Target Types**: Single IP, multiple IPs, domains, CIDR ranges
- **Scan Profiles**: Quick, Full Port, Service Detection, Vulnerability, OS Detection
- **Features**: Port detection, banner grabbing, OS fingerprinting, NSE scripts
- **AI Analysis**: Automated security assessment of scan results
- **Reports**: Branded HTML, PDF, and CSV export
- **Scheduling**: One-time, daily, weekly, monthly, custom cron
- **Backends**: Lovable Cloud edge functions or local Nmap server

### 🔎 Shodan Intelligence
- Search for exposed devices and services
- Common dork shortcuts (Open RDP, Default Passwords, Exposed DBs, etc.)
- Save and manage queries with scheduled re-runs
- Export results as CSV or JSON

### 🛡️ Microsoft Defender Integration
- Vulnerability management API integration
- Software inventory retrieval
- Machine listing and security recommendations

### 🚨 Alert Monitoring
- Rule-based alert configuration with keyword matching and URL patterns
- Severity threshold filtering (Critical, High, Medium, Low)
- Live feed scanning against configured rules
- **Automated scheduled scanning** with configurable cron intervals
- **Automatic email alerts** when rules match — uses the Alert Template
- Configurable alert email recipients

### 📨 RansomLook Integration
- Monitor ransomware group activity via RansomLook API
- Organization watchlist with configurable notifications
- Real-time group dashboard

### 🎫 ServiceDesk Integration
- ServiceNow ticket creation from AI analysis
- Configurable field mapping (title, description, priority, category)
- Basic Auth and Bearer Token support
- Sync status tracking

### 📧 Email Integration
- SMTP-based email notifications
- Send AI analysis reports via email
- Alert notification emails from automated monitoring
- Email logging with delivery status tracking

### 📝 Template System
- **Advisory Template** — Format for AI analysis reports sent via email
- **Alert Template** — Format for automated alert notifications
- Both templates support variable substitution: `{{title}}`, `{{severity}}`, `{{description}}`, `{{source}}`, `{{date}}`, `{{analysisUrl}}`, `{{appName}}`, `{{alertFooter}}`
- Live preview with sample data
- "Test Now" button to send test emails
- Configurable footer text

### 📋 Activity Log
- Email delivery history with status tracking
- ServiceDesk ticket audit trail with status changes
- Paginated views (10 items per page) with Next/Previous navigation
- Relative time tracking ("5m ago", "2h ago", "3d ago")
- Custom date range filtering with start/end date pickers
- Search and filter by status, priority, severity

### ⚙️ Settings & Configuration
- **General**: App name, fetch intervals, severity thresholds, duplicate detection
- **Branding**: Custom organization logo for reports (uploaded to storage)
- **AI**: Model selection, temperature, max tokens, custom prompts with versioning
- **Shodan**: API key management with masked input and test connection
- **Microsoft Defender**: Tenant/Client ID/Secret with test connection
- **SMTP**: Full email configuration with test
- **ServiceDesk**: ServiceNow connection with field mapping
- **Notifications**: Alert scan schedule (cron), recipient management
- **Templates**: Advisory + Alert templates with preview
- **Health Check**: Backend connectivity verification panel

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| UI | Tailwind CSS 3, shadcn/ui, Lucide Icons |
| State | TanStack React Query 5, React Hooks |
| Backend | Lovable Cloud (Supabase-compatible) or standalone PostgreSQL + PostgREST |
| Database | PostgreSQL 15 |
| Edge Functions | Deno (Supabase Edge Functions) or local Express plugins |
| AI | Lovable AI (Gemini 2.5/3, GPT-5/5-mini/5-nano/5.2) |
| Charts | Recharts 2 |
| PDF | jsPDF + jspdf-autotable |
| Markdown | react-markdown |

---

## Database Abstraction Layer

The platform includes a **configurable database layer** (`src/lib/db/`) that allows switching between Supabase Cloud and standalone PostgreSQL + PostgREST with **zero code changes** — only environment variables need to change.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Code                      │
│         import { db, invokeFunction } from "@/lib/db"    │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   src/lib/db/       │
              │   config.ts         │  ← reads VITE_DB_PROVIDER
              │   functions.ts      │  ← routes edge function calls
              │   index.ts          │  ← barrel export
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  Supabase Cloud  │         │  Standalone PG   │
│  (default)       │         │  + PostgREST     │
├──────────────────┤         ├──────────────────┤
│ REST API         │         │ PostgREST        │
│ Auth (GoTrue)    │         │ Optional GoTrue  │
│ Edge Functions   │         │ Local HTTP APIs  │
│ Storage          │         │ Local/S3 storage │
│ Realtime         │         │ Polling          │
└──────────────────┘         └──────────────────┘
```

### Component Files

| Component | File | Purpose |
|-----------|------|---------|
| Provider Config | `src/lib/db/config.ts` | Detects backend via `VITE_DB_PROVIDER` env var |
| Function Router | `src/lib/db/functions.ts` | Routes edge function calls to Supabase Functions or local HTTP endpoints |
| Barrel Export | `src/lib/db/index.ts` | Central import point: `import { db, invokeFunction } from "@/lib/db"` |

### Provider Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DB_PROVIDER` | `supabase` | `supabase` or `postgrest` |
| `VITE_SUPABASE_URL` | — | Supabase URL or PostgREST base URL |
| `VITE_FUNCTIONS_URL` | auto-detected | Override edge function / API base URL |
| `VITE_AUTH_ENABLED` | `true` | Set `false` to skip auth in standalone mode |

### Migration Readiness

| Area | Status | Notes |
|------|--------|-------|
| Database queries | ✅ Ready | `@supabase/supabase-js` is a PostgREST client — works identically |
| Edge function calls | ✅ Ready | Routed via `invokeFunction()` / `invokeProxyFunction()` |
| Schema | ✅ Ready | Full schema in `docker/db/init.sql` with PostgREST roles |
| Authentication | ⚠️ Partial | Needs GoTrue container or custom auth adapter |
| File storage | ⚠️ Partial | Needs S3/MinIO or local filesystem adapter |
| Realtime | ⚠️ Partial | Falls back to polling (not heavily used) |

### Switching to Standalone PostgreSQL

```bash
# 1. Set provider
VITE_DB_PROVIDER=postgrest

# 2. Point to PostgREST
VITE_SUPABASE_URL=http://localhost:3000

# 3. Optional: custom functions endpoint
VITE_FUNCTIONS_URL=http://localhost:3002/api

# 4. Optional: disable auth
VITE_AUTH_ENABLED=false
```

See [`docs/POSTGRESQL-STANDALONE.md`](docs/POSTGRESQL-STANDALONE.md) for the full setup guide.

---

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui primitives (40+ components)
│   ├── dashboard/       # Dashboard-specific widgets
│   ├── settings/        # Settings page components
│   ├── AppLayout.tsx    # Main layout with sidebar
│   ├── AppSidebar.tsx   # Collapsible navigation sidebar
│   ├── FeedCard.tsx     # Feed item card
│   ├── TopCVEsWidget.tsx # CVE tracking widget
│   ├── HealthCheckPanel.tsx # Backend health monitor
│   └── AICommandGenerator.tsx
├── hooks/               # Custom React hooks
│   ├── useRSSFeeds.ts   # RSS feed fetching & caching
│   ├── useFeedSources.ts # Feed source CRUD
│   ├── useScans.ts      # Network scanner state
│   ├── useSettings.ts   # App settings management (cached)
│   ├── useAuth.ts       # Authentication (role-based)
│   ├── useAutoFetchFeeds.ts # Auto-refresh timer
│   ├── useHealthCheck.ts # Backend health checks
│   ├── useScheduledJobs.ts # Job scheduling
│   ├── useActivityLog.ts # Audit trail
│   └── useRansomLookAPI.ts
├── lib/                 # Utilities
│   ├── db/              # Database abstraction layer
│   │   ├── config.ts    # Provider detection (supabase/postgrest)
│   │   ├── functions.ts # Edge function / API call routing
│   │   └── index.ts     # Barrel export (db, invokeFunction, etc.)
│   ├── api.ts           # API call helpers (uses db abstraction)
│   ├── formatters.ts    # Report formatting utilities
│   ├── pdfReportGenerator.ts # PDF generation
│   ├── settingsStore.ts # Settings type definitions
│   ├── loadSettingsFromDB.ts # DB settings loader
│   └── utils.ts         # General utilities
├── pages/               # Route pages (13 pages)
│   ├── Index.tsx        # Dashboard
│   ├── FeedManagement.tsx # Feed source management
│   ├── FeedDetail.tsx   # AI analysis view
│   ├── NetworkScanner.tsx # Nmap scanner UI
│   ├── ShodanSearch.tsx # Shodan intelligence
│   ├── AlertMonitoring.tsx # Alert rules & scanning
│   ├── RansomLook.tsx   # Ransomware monitoring
│   ├── SoftwareInventory.tsx # Defender integration
│   ├── Reports.tsx      # Report management
│   ├── ScheduleManager.tsx # Scan scheduling
│   ├── ActivityLog.tsx  # Audit trail (paginated, date-filtered)
│   ├── SettingsPage.tsx # All configuration
│   └── AuthPage.tsx     # Login / Sign up
└── integrations/        # Auto-generated backend client

supabase/
├── functions/           # Edge Functions (16 functions)
│   ├── alert-scan/      # Automated alert scanning & email
│   ├── analyze-feed/    # AI feed analysis
│   ├── analyze-scan/    # AI scan analysis
│   ├── cve-proxy/       # CVE database proxy
│   ├── defender-proxy/  # Microsoft Defender API proxy
│   ├── generate-command/ # AI command generation
│   ├── generate-scan-report/ # Report generation
│   ├── port-scan/       # Network port scanner
│   ├── ransomlook-proxy/ # RansomLook API proxy
│   ├── rss-proxy/       # RSS feed fetcher proxy
│   ├── send-email/      # SMTP email sender
│   ├── servicenow-sync/ # ServiceNow sync
│   ├── servicenow-ticket/ # ServiceNow ticket creation
│   ├── shodan-proxy/    # Shodan API proxy
│   ├── test-connection/ # Backend connectivity test
│   └── watchlist-check/ # Watchlist monitoring
├── migrations/          # Database migrations (auto-managed)
└── config.toml          # Edge function configuration

docker/                  # Self-hosting Docker configs
├── db/init.sql          # Full database schema (20 tables + PostgREST roles)
├── frontend/            # Nginx + Vite build
├── kong/                # API gateway config
├── nmap-server/         # Nmap container
└── tools-server/        # Tools container

local-nmap-server/       # Standalone Nmap API server
local-tools-server/      # Plugin-based tools server

docs/
└── POSTGRESQL-STANDALONE.md  # Standalone PostgreSQL setup guide
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth) |
| `user_roles` | Role-based access control (admin/user enum) |
| `feed_sources` | Configured RSS feed sources |
| `app_settings` | Application configuration (JSON key-value) |
| `alert_rules` | Alert monitoring rules with keywords & severity |
| `scans` | Network scan records |
| `scan_results` | Individual host scan results |
| `scan_schedules` | Scheduled scan configurations |
| `scheduled_jobs` | Generic job scheduler (Shodan, alerts, etc.) |
| `email_log` | Email delivery history |
| `ticket_log` | ServiceDesk ticket records |
| `ticket_history` | Ticket status change audit trail |
| `audit_log` | System audit trail |
| `watchlist` | RansomLook organization watchlist |
| `shodan_queries` | Saved Shodan queries |
| `shodan_results` | Cached Shodan search results |
| `top_cves` | Tracked high-severity CVEs |
| `generated_reports` | Saved scan reports (HTML/PDF) |
| `ai_prompts` | Customizable AI prompt templates |
| `ai_prompt_versions` | AI prompt version history |

### Database Functions

| Function | Purpose |
|----------|---------|
| `has_role(_user_id, _role)` | Security definer function for RLS role checks |
| `handle_new_user()` | Trigger: auto-creates profile + assigns role on signup |
| `update_updated_at_column()` | Trigger: auto-updates `updated_at` timestamps |

---

## Deployment Options

### Option 1: Lovable Cloud (Recommended)

1. Open the project in [Lovable](https://lovable.dev)
2. Backend is automatically provisioned (database, edge functions, storage)
3. Configure integrations in **Settings**
4. Add RSS feeds in **Feed Sources**
5. Dashboard populates with live threat data

### Option 2: Self-Hosted — Full Stack (Docker)

Complete Supabase-compatible stack with Auth, Realtime, and API Gateway.

See **[SELF-HOSTING.md](./SELF-HOSTING.md)** for the full guide.

```bash
cp .env.docker.example .env.docker
# Edit .env.docker with your secrets
docker compose --env-file .env.docker up -d
# Dashboard → http://localhost:8080
```

### Option 3: Self-Hosted — Standalone PostgreSQL

Minimal 4-container stack using PostgreSQL + PostgREST. No Supabase account needed.

See **[docs/POSTGRESQL-STANDALONE.md](./docs/POSTGRESQL-STANDALONE.md)** for the full guide.

```bash
cp .env.docker.example .env.docker
# Set VITE_DB_PROVIDER=postgrest, POSTGRES_PASSWORD, JWT_SECRET
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d
# Dashboard → http://localhost:8080
```

### Option 4: Local Development

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

---

## Environment Variables

### Lovable Cloud (auto-configured)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public API key |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Self-Hosted (Docker)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_DB_PROVIDER` | No | `supabase` (default) or `postgrest` |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `VITE_SUPABASE_ANON_KEY` | Yes | JWT-signed anon key |
| `VITE_SUPABASE_URL` | Yes | API gateway or PostgREST URL |
| `VITE_LOCAL_NMAP_URL` | No | Nmap server URL (default: `http://localhost:3001`) |
| `VITE_LOCAL_TOOLS_URL` | No | Tools server URL (default: `http://localhost:3002`) |
| `VITE_FUNCTIONS_URL` | No | Override edge function base URL |
| `VITE_AUTH_ENABLED` | No | Set `false` to disable auth (standalone mode) |
| `SMTP_HOST/PORT/USER/PASS` | No | Email server config |
| `SHODAN_API_KEY` | No | Shodan API key |
| `DEFENDER_*` | No | Microsoft Defender credentials |
| `LOVABLE_API_KEY` | No | Lovable AI API key |

---

## Edge Functions

16 serverless functions handle external API proxying, AI analysis, and integrations:

| Function | Type | Description |
|----------|------|-------------|
| `rss-proxy` | Proxy | Fetches and parses RSS/Atom feeds |
| `cve-proxy` | Proxy | Queries NVD/CVE databases |
| `shodan-proxy` | Proxy | Proxies Shodan API requests |
| `ransomlook-proxy` | Proxy | Proxies RansomLook API |
| `defender-proxy` | Proxy | Microsoft Defender ATP with OAuth2 |
| `analyze-feed` | AI | AI-powered feed analysis |
| `analyze-scan` | AI | AI-powered scan assessment |
| `generate-command` | AI | AI command generation |
| `generate-scan-report` | Report | HTML/PDF scan report generation |
| `send-email` | Integration | SMTP email sender |
| `servicenow-ticket` | Integration | ServiceNow ticket creation |
| `servicenow-sync` | Integration | ServiceNow bi-directional sync |
| `alert-scan` | Automation | RSS scan + rule matching + email alerts |
| `watchlist-check` | Automation | Watchlist monitoring |
| `port-scan` | Scanner | Network port scanning via Nmap |
| `test-connection` | Utility | Backend connectivity verification |

### Deploying Edge Functions

```bash
# Deploy all edge functions
for fn in alert-scan analyze-feed analyze-scan cve-proxy defender-proxy \
  generate-command generate-scan-report port-scan ransomlook-proxy \
  rss-proxy send-email servicenow-sync servicenow-ticket shodan-proxy \
  test-connection watchlist-check; do
  supabase functions deploy $fn
done

# Set required secrets
supabase secrets set LOVABLE_API_KEY=your-key
```

---

## Security

- **API keys** stored encrypted in database settings (never in client code)
- **Masked display** in UI (•••• format) for all sensitive values
- **Edge functions** validate inputs and sanitize parameters
- **Network scanner** rate-limited: max 64 hosts, 500 ports per scan
- **CIDR ranges** capped to prevent abuse
- **Role-based access control** (admin/user) with PostgreSQL RLS policies
- **First registered user** automatically gets admin role
- **Security definer functions** prevent RLS recursion on role checks
- **No mock data** — all data is live from configured sources

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [SELF-HOSTING.md](./SELF-HOSTING.md) | Full Docker Compose deployment guide |
| [docs/POSTGRESQL-STANDALONE.md](./docs/POSTGRESQL-STANDALONE.md) | Standalone PostgreSQL setup (no Supabase) |
| [local-nmap-server/README.md](./local-nmap-server/README.md) | Nmap API server documentation |
| [local-tools-server/README.md](./local-tools-server/README.md) | Tools server plugin architecture |

---

## License

Private project. All rights reserved.
