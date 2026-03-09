# Threat Intelligence Platform

A comprehensive **Threat Intelligence + Vulnerability Scanning + AI Advisory System** built with React, TypeScript, and Lovable Cloud.

## Overview

This platform aggregates, correlates, and analyzes security threat data from multiple sources, providing real-time monitoring, AI-powered analysis, network scanning, and enterprise-grade reporting capabilities.

### Core Purpose

- **Threat Intelligence Aggregation** — Ingest and correlate RSS feeds from trusted security sources (CISA, NVD, Krebs, Talos, etc.)
- **Vulnerability Scanning** — TCP-based network scanning with port detection, banner grabbing, and service identification
- **AI-Powered Analysis** — Automated threat analysis with risk scoring and remediation recommendations using Lovable AI models
- **Enterprise Reporting** — Branded PDF/HTML/CSV reports with customizable templates

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

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Lucide Icons |
| State | React Query, React Hooks |
| Backend | Lovable Cloud (Supabase) |
| Database | PostgreSQL (via Supabase) |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI | Lovable AI (Gemini, GPT-5 models) |
| Charts | Recharts |

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
└── integrations/       # Auto-generated Supabase client

supabase/
├── functions/          # Edge Functions
│   ├── rss-proxy/      # RSS feed proxy
│   ├── port-scan/      # Network scanner
│   ├── analyze-scan/   # AI scan analysis
│   ├── analyze-feed/   # AI feed analysis
│   ├── generate-scan-report/ # Report generation
│   ├── shodan-proxy/   # Shodan API proxy
│   ├── defender-proxy/ # Microsoft Defender proxy
│   ├── send-email/     # SMTP email sender
│   ├── servicenow-ticket/ # ServiceNow integration
│   └── ransomlook-proxy/
└── migrations/         # Database migrations
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
| `email_log` | Email delivery history |
| `ticket_log` | ServiceDesk ticket history |
| `ticket_history` | Ticket status changes |
| `audit_log` | System audit trail |
| `watchlist` | RansomLook organization watchlist |
| `shodan_queries` | Saved Shodan queries |
| `shodan_results` | Cached Shodan results |

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

### Local Development

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The app connects to the Lovable Cloud backend automatically via environment variables (`.env`).

### Environment Variables

These are auto-configured by Lovable Cloud:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public API key |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Setting Up a New Supabase Instance

If deploying with a separate Supabase project:

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration files in `supabase/migrations/` in order
3. Create a storage bucket named `org-assets` (public)
4. Deploy edge functions:
   ```bash
   supabase functions deploy rss-proxy
   supabase functions deploy port-scan
   supabase functions deploy analyze-scan
   supabase functions deploy analyze-feed
   supabase functions deploy generate-scan-report
   supabase functions deploy shodan-proxy
   supabase functions deploy defender-proxy
   supabase functions deploy send-email
   supabase functions deploy servicenow-ticket
   supabase functions deploy ransomlook-proxy
   ```
5. Set the `LOVABLE_API_KEY` secret for AI functionality:
   ```bash
   supabase secrets set LOVABLE_API_KEY=your-key
   ```
6. Update `.env` with your Supabase project credentials

## Production Deployment

1. Click **Share → Publish** in Lovable to deploy
2. Optionally connect a custom domain in **Settings → Domains**

## Security Notes

- All API keys are stored encrypted in the database settings (not in client code)
- API keys are masked in the UI (•••• format)
- Edge functions validate inputs and sanitize parameters
- Network scanner has rate limiting (max 64 hosts, 500 ports per scan)
- CIDR ranges are capped to prevent abuse
- No mock or placeholder data in production — all data is live from configured sources

## License

Private project. All rights reserved.
