# ThreatIntel — Local API Server

Self-hosted backend replacing Supabase for fully local deployment.

## Quick Start

### Option 1: Docker Compose (recommended)
```bash
# From project root
docker compose up -d
```
This starts PostgreSQL, the API server, and the frontend.

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
# Add to your .env:
VITE_BACKEND_MODE=local
VITE_API_URL=http://localhost:3001

npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `PORT` | No | API port (default: 3001) |
| `AI_API_KEY` | No | OpenAI/Google API key for AI features |
| `AI_ENDPOINT_URL` | No | Custom AI endpoint |
| `SHODAN_API_KEY` | No | Shodan API key |
| `DEFENDER_TENANT_ID` | No | Microsoft Defender tenant |
| `DEFENDER_CLIENT_ID` | No | Microsoft Defender client |
| `DEFENDER_CLIENT_SECRET` | No | Microsoft Defender secret |

## Frontend Setup

Set `VITE_BACKEND_MODE=local` in your `.env` file, then update imports in frontend files:

```typescript
// Replace:
import { supabase } from "@/integrations/supabase/client";
// With:
import { db } from "@/lib/apiClient";
// Then use `db` everywhere instead of `supabase`
```

## API Endpoints

- `POST /api/auth/signup` — Register
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/auth/session` — Validate session
- `GET/POST/PATCH/DELETE /api/db/:table` — Generic CRUD
- `POST /api/functions/:name` — Edge function equivalents
- `POST /api/storage/:bucket/upload` — File upload
- `GET /api/storage/:bucket/:file` — Serve files
