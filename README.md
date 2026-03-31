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
| Frontend | React 18, TypeScript, Vite 5 |
| UI | Tailwind CSS 3, shadcn/ui, Lucide Icons |
| State | TanStack React Query 5, React Hooks |
| Backend | Lovable Cloud (Supabase-compatible) |
| Database | PostgreSQL 15 |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI | Lovable AI (Gemini 2.5/3, GPT-5/5-mini/5-nano/5.2) |
| Charts | Recharts 2 |
| PDF | jsPDF + jspdf-autotable |
| Markdown | react-markdown |

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
│   ├── useAuth.ts       # Authentication
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
│   ├── api.ts           # API call helpers
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
│   ├── ActivityLog.tsx  # Audit trail
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
├── db/init.sql          # Full database schema
├── frontend/            # Nginx + Vite build
├── kong/                # API gateway config
├── nmap-server/         # Nmap container
└── tools-server/        # Tools container

local-nmap-server/       # Standalone Nmap API server
local-tools-server/      # Plugin-based tools server
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth) |
| `user_roles` | Role-based access (admin/user) |
| `feed_sources` | Configured RSS feed sources |
| `app_settings` | Application configuration (JSON key-value) |
| `alert_rules` | Alert monitoring rules |
| `scans` | Network scan records |
| `scan_results` | Individual host scan results |
| `scan_schedules` | Scheduled scan configurations |
| `scheduled_jobs` | Generic job scheduler (Shodan, etc.) |
| `email_log` | Email delivery history |
| `ticket_log` | ServiceDesk ticket records |
| `ticket_history` | Ticket status change audit |
| `audit_log` | System audit trail |
| `watchlist` | RansomLook organization watchlist |
| `shodan_queries` | Saved Shodan queries |
| `shodan_results` | Cached Shodan search results |
| `top_cves` | Tracked high-severity CVEs |
| `generated_reports` | Saved scan reports |
| `ai_prompts` | Customizable AI prompt templates |
| `ai_prompt_versions` | AI prompt version history |

---

## Setup Instructions

### Quick Start (Lovable Cloud)

1. Open the project in [Lovable](https://lovable.dev)
2. The backend (database, edge functions, storage) is automatically provisioned
3. Navigate to **Settings** to configure integrations:
   - Select your preferred AI model
   - Add Shodan API key (optional)
   - Configure Microsoft Defender credentials (optional)
   - Set up SMTP for email notifications (optional)
   - Configure ServiceNow for ticket creation (optional)
4. Go to **Feed Sources** and add your RSS feeds
5. The dashboard will populate with live threat data

### Self-Hosted — Full Stack (Docker)

See **[SELF-HOSTING.md](./SELF-HOSTING.md)** for the complete Docker Compose setup including PostgreSQL, Supabase Auth, API Gateway, Realtime, and local tool servers.

```bash
cp .env.docker.example .env.docker
# Edit .env.docker with your secrets
docker compose --env-file .env.docker up -d
# Dashboard → http://localhost:8080
```

### Self-Hosted — Standalone PostgreSQL (No Supabase)

A lighter alternative using only PostgreSQL + PostgREST (4 containers instead of 7). No Supabase account or services needed.

See **[docs/POSTGRESQL-STANDALONE.md](./docs/POSTGRESQL-STANDALONE.md)** for the full guide.

```bash
cp .env.docker.example .env.docker
# Edit .env.docker (set POSTGRES_PASSWORD, JWT_SECRET, generate VITE_SUPABASE_ANON_KEY)
docker compose -f docker-compose.standalone.yml --env-file .env.docker up -d
# Dashboard → http://localhost:8080
```

### Local Development

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The app connects to the Lovable Cloud backend automatically via environment variables (`.env`).

---

## Environment Variables

### Lovable Cloud (auto-configured)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public API key |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Self-Hosted (Docker)

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `VITE_SUPABASE_ANON_KEY` | JWT-signed anon key |
| `VITE_SUPABASE_URL` | API gateway URL |
| `VITE_LOCAL_NMAP_URL` | Nmap server URL |
| `VITE_LOCAL_TOOLS_URL` | Tools server URL |
| `SMTP_HOST/PORT/USER/PASS` | Email server (optional) |
| `SHODAN_API_KEY` | Shodan API (optional) |
| `DEFENDER_*` | Microsoft Defender (optional) |

---

## Deploying Edge Functions

If deploying with a separate Supabase project:

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

## Security Notes

- All API keys are stored encrypted in the database settings (not in client code)
- API keys are masked in the UI (•••• format)
- Edge functions validate inputs and sanitize parameters
- Network scanner has rate limiting (max 64 hosts, 500 ports per scan)
- CIDR ranges are capped to prevent abuse
- Role-based access control (admin/user) with RLS policies
- First registered user automatically gets admin role
- No mock or placeholder data in production — all data is live

---

## License

Private project. All rights reserved.
