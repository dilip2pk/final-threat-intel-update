# Threat Intelligence Platform

A comprehensive **Threat Intelligence + Vulnerability Scanning + AI Advisory System** built with React, TypeScript, and a flexible backend supporting both Lovable Cloud and self-hosted PostgreSQL.

## Overview

This platform aggregates, correlates, and analyzes security threat data from multiple sources, providing real-time monitoring, AI-powered analysis, network scanning, and enterprise-grade reporting capabilities.

### Core Purpose

- **Threat Intelligence Aggregation** — Ingest and correlate RSS feeds from trusted security sources (CISA, NVD, Krebs, Talos, etc.)
- **Vulnerability Scanning** — TCP-based network scanning with port detection, banner grabbing, and service identification
- **AI-Powered Analysis** — Automated threat analysis with risk scoring and remediation recommendations
- **Enterprise Reporting** — Branded PDF/HTML/CSV reports with customizable templates

## Deployment Options

| Mode | Backend | Best For |
|------|---------|----------|
| **Lovable Cloud** (default) | Managed Supabase | Zero-config, hosted deployment |
| **Local Self-Hosted** | PostgreSQL + Express API | Air-gapped environments, full control |

The frontend uses an abstraction layer (`src/lib/apiClient.ts`) that switches between backends based on the `VITE_BACKEND_MODE` environment variable. No UI changes needed.

## Key Features

### 📡 RSS Feed Management
- Add/edit/remove custom RSS feed sources
- Test feed URL connectivity before saving
- Enable/disable individual feeds
- Live feed ingestion with duplicate detection

### 🔍 Threat Intelligence Dashboard
- Real-time aggregation of security articles from configured feeds
- CVE feed panel (High & Critical severity)
- Search and filter by source
- Click-through to AI-powered feed analysis

### 🧠 AI Analysis Engine
- One-click AI analysis of any feed item
- Executive summary, technical findings, risk assessment
- Remediation recommendations with priority levels
- Export as Markdown, email, or ServiceDesk ticket
- Configurable AI model selection (Gemini, GPT-5, etc.)

### 🌐 Network Scanner
- **Target Types**: Single IP, multiple IPs, domains, CIDR ranges
- **Scan Profiles**: Quick, Full Port, Service Detection, Vulnerability
- **Features**: Port detection, banner grabbing, OS fingerprinting
- **AI Analysis**: Automated security assessment of scan results
- **Reports**: Branded HTML and CSV export
- **Scheduling**: One-time, daily, weekly, monthly, custom cron

### 🔎 Shodan Intelligence
- Search for exposed devices and services
- Common dork shortcuts (Open RDP, Default Passwords, Exposed DBs, etc.)
- Save and manage queries
- Export results as CSV or JSON

### 🛡️ Microsoft Defender Integration
- Vulnerability management API integration
- Software inventory retrieval
- Machine listing and security recommendations

### 🚨 Alert Monitoring
- Rule-based alert configuration with keyword matching
- Severity threshold filtering
- Live feed scanning against configured rules

### 📨 RansomLook Integration
- Monitor ransomware group activity
- Organization watchlist with notifications
- Real-time group dashboard

### 🎫 ServiceDesk Integration
- ServiceNow ticket creation from analysis
- Configurable field mapping
- Basic Auth and Bearer Token support

### 📧 Email Integration
- SMTP-based email notifications
- Send AI analysis reports via email
- Email logging with delivery status

### ⚙️ Settings & Configuration
- **General**: Fetch intervals, severity thresholds, duplicate detection
- **Branding**: Custom organization logo for reports
- **AI**: Model selection, temperature, max tokens
- **Shodan**: API key management with masked input and test connection
- **Microsoft Defender**: Tenant/Client ID/Secret with test connection
- **SMTP**: Full email configuration
- **ServiceDesk**: ServiceNow connection with field mapping
- **Notifications**: Slack, email, webhook, Telegram, Discord
- **Alert Template**: Customizable alert format with variables

## Technology Stack

| Layer | Cloud Mode | Local Mode |
|-------|-----------|------------|
| Frontend | React 18, TypeScript, Vite | Same |
| UI | Tailwind CSS, shadcn/ui, Lucide Icons | Same |
| State | React Query, React Hooks | Same |
| Backend | Lovable Cloud (Supabase) | Express.js API Server |
| Database | PostgreSQL (managed) | PostgreSQL (self-hosted) |
| Functions | Deno Edge Functions | Node.js Express Routes |
| AI | Lovable AI models | Direct OpenAI/Google API keys |
| Auth | Supabase Auth | JWT + bcrypt |
| Charts | Recharts | Same |

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui primitives
│   ├── AppLayout.tsx   # Main layout with sidebar
│   ├── AppSidebar.tsx  # Navigation sidebar
│   ├── FeedCard.tsx    # Feed item card
│   └── SeverityFilter.tsx
├── hooks/              # Custom React hooks
│   ├── useRSSFeeds.ts  # RSS feed fetching
│   ├── useFeedSources.ts # Feed source CRUD
│   ├── useScans.ts     # Network scanner state
│   ├── useSettings.ts  # App settings management
│   └── useRansomLookAPI.ts
├── lib/                # Utilities
│   ├── apiClient.ts    # Backend abstraction layer (Supabase ↔ Local)
│   ├── api.ts          # API call helpers
│   ├── formatters.ts   # Report formatting
│   ├── mockData.ts     # Type definitions & helpers
│   └── settingsStore.ts # Settings types
├── pages/              # Route pages
│   ├── Index.tsx       # Dashboard
│   ├── FeedManagement.tsx
│   ├── FeedDetail.tsx  # AI analysis view
│   ├── NetworkScanner.tsx
│   ├── ShodanSearch.tsx
│   ├── AlertMonitoring.tsx
│   ├── SettingsPage.tsx
│   └── ...
└── integrations/       # Auto-generated Supabase client (cloud mode)

local-api-server/       # Self-hosted Express backend
├── server.js           # Express app entry point
├── db.js               # PostgreSQL connection pool
├── init.sql            # Combined schema (18 tables, enums, triggers)
├── middleware/
│   └── auth.js         # JWT validation middleware
├── routes/
│   ├── auth.js         # Signup, login, session, password reset
│   ├── db.js           # Generic CRUD for all tables
│   ├── functions.js    # All 15 edge function ports
│   └── storage.js      # File upload/serve (multer)
├── Dockerfile
├── package.json
└── .env.example

supabase/               # Cloud mode backend
├── functions/          # Edge Functions (Deno)
│   ├── rss-proxy/
│   ├── port-scan/
│   ├── analyze-feed/
│   ├── analyze-scan/
│   ├── generate-scan-report/
│   ├── shodan-proxy/
│   ├── defender-proxy/
│   ├── send-email/
│   ├── servicenow-ticket/
│   └── ransomlook-proxy/
└── migrations/

docker-compose.yml      # One-command local deployment
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `feed_sources` | Configured RSS feed sources |
| `app_settings` | Application configuration (JSON key-value) |
| `alert_rules` | Alert monitoring rules |
| `scans` | Network scan records |
| `scan_results` | Individual host scan results |
| `scan_schedules` | Scheduled scan configurations |
| `scheduled_jobs` | General scheduled job configurations |
| `email_log` | Email delivery history |
| `ticket_log` | ServiceDesk ticket history |
| `ticket_history` | Ticket status changes |
| `audit_log` | System audit trail |
| `watchlist` | RansomLook organization watchlist |
| `shodan_queries` | Saved Shodan queries |
| `shodan_results` | Cached Shodan results |
| `generated_reports` | Stored scan reports |
| `top_cves` | Tracked high-severity CVEs |
| `profiles` | User profile data |
| `user_roles` | Role-based access control |

---

## Setup Instructions

### Option 1: Lovable Cloud (Default)

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

### Option 2: Local Self-Hosted (Docker)

One-command deployment with Docker Compose:

```bash
# Clone and start everything
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5432 (auto-initialized with schema)
- **Express API Server** on port 3001
- **React Frontend** on port 8080

The first user to sign up is automatically assigned the **admin** role.

### Option 3: Local Self-Hosted (Manual)

#### 1. Set up PostgreSQL

```bash
createdb threat_intel
psql -d threat_intel -f local-api-server/init.sql
```

#### 2. Start the API server

```bash
cd local-api-server
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, and optional API keys
npm install
npm run dev
```

#### 3. Start the frontend

```bash
# From project root — set backend mode
# Add to .env or .env.local:
#   VITE_BACKEND_MODE=local
#   VITE_API_URL=http://localhost:3001

npm install
npm run dev
```

---

## Environment Variables

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_BACKEND_MODE` | `supabase` | `supabase` or `local` |
| `VITE_API_URL` | — | Local API URL (required when mode is `local`) |
| `VITE_SUPABASE_URL` | (auto) | Supabase API URL (cloud mode) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (auto) | Supabase anon key (cloud mode) |

### Local API Server

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `PORT` | No | API port (default: 3001) |
| `AI_API_KEY` | No | OpenAI or Google API key for AI features |
| `AI_ENDPOINT_URL` | No | Custom AI endpoint URL |
| `AI_MODEL` | No | AI model name (e.g. `gpt-4o`) |
| `SHODAN_API_KEY` | No | Shodan API key |
| `DEFENDER_TENANT_ID` | No | Microsoft Defender tenant ID |
| `DEFENDER_CLIENT_ID` | No | Microsoft Defender client ID |
| `DEFENDER_CLIENT_SECRET` | No | Microsoft Defender client secret |
| `TOOLS_API_KEY` | No | API key for local-tools-server (Nmap) |

---

## Local API Endpoints

When running in local mode, the Express server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/signup` | POST | Register (first user = admin) |
| `/api/auth/login` | POST | Login (returns JWT) |
| `/api/auth/session` | GET | Validate session |
| `/api/auth/signout` | POST | Sign out |
| `/api/auth/user` | PUT | Update password |
| `/api/db/:table` | GET | Query with filters, ordering, pagination |
| `/api/db/:table` | POST | Insert row(s) |
| `/api/db/:table` | PATCH | Update row(s) with filters |
| `/api/db/:table` | DELETE | Delete row(s) with filters |
| `/api/functions/:name` | POST | Execute function (15 available) |
| `/api/storage/:bucket/upload` | POST | Upload file |
| `/api/storage/:bucket/:file` | GET | Serve uploaded file |

### Available Functions

`rss-proxy`, `ransomlook-proxy`, `shodan-proxy`, `cve-proxy`, `defender-proxy`, `port-scan`, `analyze-feed`, `analyze-scan`, `generate-command`, `generate-scan-report`, `send-email`, `servicenow-ticket`, `servicenow-sync`, `test-connection`, `watchlist-check`

---

## Production Deployment

### Cloud
1. Click **Share → Publish** in Lovable
2. Optionally connect a custom domain in **Settings → Domains**

### Self-Hosted
1. Configure `docker-compose.yml` with production passwords and secrets
2. Set `JWT_SECRET` to a strong random value
3. Add a reverse proxy (nginx/Caddy) with TLS
4. Run `docker compose up -d`

---

## Security Notes

- All API keys are stored in the database settings (not in client code)
- API keys are masked in the UI (•••• format)
- Edge functions / API routes validate inputs and sanitize parameters
- Network scanner has rate limiting (max 64 hosts, 500 ports per scan)
- CIDR ranges are capped to prevent abuse
- Local mode uses JWT authentication with bcrypt password hashing
- Role-based access control (admin/user) enforced at the API layer
- No mock or placeholder data in production — all data is live from configured sources

## License

Private project. All rights reserved.
