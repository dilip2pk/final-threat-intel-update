

# Migration Plan: Supabase to Local PostgreSQL

This is a significant architectural migration. Here is a comprehensive breakdown of everything involved.

---

## Current Supabase Dependencies (What Needs Replacing)

| Dependency | Usage | Files Affected |
|---|---|---|
| **Database (`.from()`)** | CRUD on 12+ tables | 12 files across hooks, pages, lib |
| **Auth (`supabase.auth.*`)** | Login, signup, session, roles | `useAuth.ts`, `AuthPage.tsx` |
| **Edge Functions (`.functions.invoke()`)** | 15 serverless functions | 9 files |
| **Storage (`.storage`)** | Logo/icon uploads | `SettingsPage.tsx` |
| **Realtime** | Not currently used | N/A |

---

## Architecture: What to Build

```text
┌─────────────────────────┐
│   React Frontend        │
│   (unchanged UI)        │
└───────────┬─────────────┘
            │ HTTP (fetch / axios)
┌───────────▼─────────────┐
│   Express API Server    │  ← NEW (replaces Edge Functions + Supabase client)
│   - /api/auth/*         │  (JWT-based auth with bcrypt)
│   - /api/db/*           │  (CRUD endpoints for all tables)
│   - /api/functions/*    │  (ports all 15 edge functions)
│   - /api/storage/*      │  (file upload to local disk)
│   - /api/tools/*        │  (existing local-tools-server merged)
└───────────┬─────────────┘
            │ pg / knex
┌───────────▼─────────────┐
│   PostgreSQL (local)    │
│   Same schema as today  │
└─────────────────────────┘
```

---

## Step-by-Step Plan

### 1. Set Up Local PostgreSQL Schema
- Combine all 9 migration files into a single `init.sql`
- Create all 12 tables: `feed_sources`, `app_settings`, `alert_rules`, `scans`, `scan_results`, `scan_schedules`, `email_log`, `ticket_log`, `ticket_history`, `audit_log`, `watchlist`, `shodan_queries`, `shodan_results`, `generated_reports`, `profiles`, `user_roles`, `top_cves`, `scheduled_jobs`
- Create the `app_role` enum and DB functions (`has_role`, `handle_new_user`, `update_updated_at_column`)
- RLS is not needed locally (handled by API middleware)

### 2. Build Express API Server (`local-api-server/`)
Expand the existing `local-tools-server/` into a full backend:

**Auth endpoints** (replaces `supabase.auth`):
- `POST /api/auth/signup` — bcrypt password, insert into `users` + `profiles` + `user_roles`
- `POST /api/auth/login` — verify password, return JWT
- `GET /api/auth/session` — validate JWT, return user
- `POST /api/auth/logout` — client-side token removal
- Middleware: `authMiddleware` extracts JWT and sets `req.user`

**Database endpoints** (replaces `supabase.from()`):
- Generic CRUD: `GET/POST/PUT/DELETE /api/db/:table`
- Query params for filtering (`.eq()`, `.order()`, `.single()`)
- Role-based access checks in middleware (admin vs user)

**Function endpoints** (replaces `supabase.functions.invoke()`):
- Port each of the 15 edge functions to Express routes under `/api/functions/`
- Same request/response contracts, just running in Node.js instead of Deno
- Key functions: `rss-proxy`, `port-scan`, `analyze-feed`, `analyze-scan`, `shodan-proxy`, `cve-proxy`, `send-email`, `servicenow-ticket`, `defender-proxy`, `watchlist-check`, `generate-scan-report`, `generate-command`, `test-connection`, `servicenow-sync`, `ransomlook-proxy`

**Storage endpoints** (replaces `supabase.storage`):
- `POST /api/storage/upload` — save to `./uploads/` directory
- `GET /api/storage/:filename` — serve static files
- Used for org logos/icons

### 3. Create Frontend API Abstraction Layer
Create `src/lib/apiClient.ts` — a drop-in replacement for the Supabase client:

```typescript
// Replaces: import { supabase } from "@/integrations/supabase/client"
// Usage:    import { api } from "@/lib/apiClient"

api.from("scans").select("*").eq("status", "completed")  // → GET /api/db/scans?status=completed
api.from("scans").insert({...})                            // → POST /api/db/scans
api.functions.invoke("analyze-feed", { body })             // → POST /api/functions/analyze-feed
api.auth.signInWithPassword({ email, password })           // → POST /api/auth/login
api.storage.from("org-assets").upload(path, file)          // → POST /api/storage/upload
```

This approach means **minimal changes to existing component code** — just swap the import.

### 4. Update All Frontend Files
Files requiring the import swap (23 files total):
- `src/hooks/useAuth.ts` — replace `supabase.auth.*` with `api.auth.*`
- `src/hooks/useFeedSources.ts`, `useScans.ts`, `useScheduledJobs.ts`, `useActivityLog.ts`, `useSettings.ts`, `useRSSFeeds.ts`
- `src/pages/AuthPage.tsx`, `NetworkScanner.tsx`, `ShodanSearch.tsx`, `SettingsPage.tsx`, `FeedManagement.tsx`, `SoftwareInventory.tsx`, `Reports.tsx`, `ScheduleManager.tsx`, `AlertMonitoring.tsx`
- `src/lib/api.ts`, `loadSettingsFromDB.ts`
- `src/components/TopCVEsWidget.tsx`, `AICommandGenerator.tsx`

### 5. Environment Configuration
Create a `.env.local`:
```
VITE_API_URL=http://localhost:3001
DATABASE_URL=postgresql://user:pass@localhost:5432/threat_intel
JWT_SECRET=your-secret-key
```

### 6. Docker Compose (Optional but Recommended)
```yaml
services:
  db:
    image: postgres:16
    volumes: ["./init.sql:/docker-entrypoint-initdb.d/init.sql"]
  api:
    build: ./local-api-server
    depends_on: [db]
  frontend:
    build: .
    depends_on: [api]
```

---

## Risk Areas & Mitigations

| Risk | Mitigation |
|---|---|
| Auth session management differs from Supabase | Use JWT with httpOnly cookies or localStorage, matching current behavior |
| Edge functions use Deno APIs | Port to Node.js — most are simple fetch-based proxies |
| `LOVABLE_API_KEY` for AI | Must self-host AI or use direct API keys to OpenAI/Google |
| Supabase types file (`types.ts`) | Generate from local PG schema with `pg-to-ts` or maintain manually |
| File uploads | Simple `multer` + local disk storage |

---

## Estimated Scope

- **New files**: ~20 (API server routes, DB client, auth middleware, Docker config)
- **Modified files**: ~23 (import swap from supabase to local API client)
- **Edge function ports**: 15 functions → Express routes
- **No UI changes** — all pages/components remain identical

This is a multi-session effort. I recommend tackling it in phases: (1) DB + API server scaffold, (2) Auth, (3) CRUD endpoints, (4) Edge function ports, (5) Frontend swap.

