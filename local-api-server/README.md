# ThreatIntel — Local API Server

Self-hosted backend replacing Supabase for fully local deployment.

## Quick Start

### Option 1: Docker Compose (recommended)
```bash
# From project root
docker compose up -d
```
This starts:
- **PostgreSQL 16** on port 5432 (auto-initialized with schema)
- **Express API Server** on port 3001 (waits for DB to be ready)
- **React Frontend** on port 8080 (built with local mode)

The first user to sign up is automatically assigned the **admin** role.

### Option 2: Manual Setup

1. **PostgreSQL**: Create database and run schema:
```bash
createdb threat_intel
psql -d threat_intel -f local-api-server/init.sql
```

2. **API Server**:
```bash
cd local-api-server
cp .env.example .env   # Edit DATABASE_URL, JWT_SECRET
npm install
npm run dev
```

3. **Frontend** (from project root):
```bash
# Add to your .env.local:
VITE_BACKEND_MODE=local
VITE_API_URL=http://localhost:3001

npm install
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (change in production!) |
| `PORT` | No | API port (default: 3001) |
| `AI_API_KEY` | No | OpenAI/Google API key for AI features |
| `AI_ENDPOINT_URL` | No | Custom AI endpoint |
| `AI_MODEL` | No | AI model name (default: gpt-4o) |
| `SHODAN_API_KEY` | No | Shodan API key |
| `DEFENDER_TENANT_ID` | No | Microsoft Defender tenant |
| `DEFENDER_CLIENT_ID` | No | Microsoft Defender client |
| `DEFENDER_CLIENT_SECRET` | No | Microsoft Defender secret |
| `TOOLS_API_KEY` | No | API key for local-tools-server (Nmap) |

## Frontend Configuration

Set `VITE_BACKEND_MODE=local` in your `.env` or `.env.local` file. The frontend abstraction layer (`src/lib/apiClient.ts`) automatically routes all calls to the local Express API instead of Supabase.

**Important**: Vite bakes environment variables at build time. If using Docker, the `VITE_BACKEND_MODE` and `VITE_API_URL` are passed as build args in the Dockerfile.

## API Endpoints

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
| `/api/db/:table/upsert` | POST | Upsert with conflict resolution |
| `/api/functions/:name` | GET/POST | Execute function (15 available) |
| `/api/storage/:bucket/upload` | POST | Upload file |
| `/api/storage/:bucket/:file` | GET | Serve uploaded file |
| `/api/storage/:bucket` | GET | List files in bucket |
| `/api/storage/:bucket/:file` | DELETE | Delete file |

### Available Functions

`rss-proxy`, `ransomlook-proxy`, `shodan-proxy`, `cve-proxy`, `defender-proxy`, `port-scan`, `analyze-feed`, `analyze-scan`, `generate-command`, `generate-scan-report`, `send-email`, `servicenow-ticket`, `servicenow-sync`, `test-connection`, `watchlist-check`

## Production Deployment

1. Change `JWT_SECRET` to a strong random value
2. Change PostgreSQL password in `docker-compose.yml`
3. Set API keys for integrations you need (AI, Shodan, Defender)
4. Add a reverse proxy (nginx/Caddy) with TLS in front of ports 3001 and 8080
5. Run `docker compose up -d`

## Data Persistence

- **Database**: PostgreSQL data is persisted in the `pgdata` Docker volume
- **Uploads**: File uploads are persisted in the `api-uploads` Docker volume
- To backup: `docker compose exec db pg_dump -U postgres threat_intel > backup.sql`
- To restore: `docker compose exec -i db psql -U postgres threat_intel < backup.sql`
