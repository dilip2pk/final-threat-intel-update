

# Local PostgreSQL Migration Plan (Optional Self-Hosted Setup)

This creates a parallel local deployment option alongside the existing Supabase setup, so users can choose either mode.

---

## Scope Summary

| Component | Supabase Dependency | Local Replacement |
|---|---|---|
| Database (20 files, `.from()`) | Supabase Postgres + RLS | Local PostgreSQL + Express API |
| Auth (2 files) | `supabase.auth.*` | JWT + bcrypt via Express |
| Edge Functions (9 files, 15 functions) | `supabase.functions.invoke()` | Express routes under `/api/functions/` |
| Storage (1 file) | `supabase.storage` | multer + static file serving |

---

## What Gets Built

### 1. Combined `init.sql` Schema File
Single file with all 18 tables, the `app_role` enum, `has_role()` function, `handle_new_user()` trigger function, and `update_updated_at_column()` trigger. No RLS (access control handled in API middleware).

### 2. `local-api-server/` — Full Express Backend
Extends the existing `local-tools-server/` concept into a complete backend:

- **Auth routes** (`/api/auth/signup`, `/api/auth/login`, `/api/auth/session`, `/api/auth/reset-password`) using bcrypt + jsonwebtoken
- **Generic DB CRUD** (`/api/db/:table`) supporting `select`, `insert`, `update`, `delete` with query params for `.eq()`, `.order()`, `.single()`, `.limit()`
- **15 function routes** (`/api/functions/:name`) — direct Node.js ports of each Deno edge function (most are simple HTTP proxies, so minimal changes)
- **Storage routes** (`/api/storage/upload`, `/api/storage/:bucket/:file`) using multer for file uploads, serving from `./uploads/`
- **Auth middleware** that validates JWT and injects `req.user` with role info

### 3. `src/lib/apiClient.ts` — Frontend Abstraction Layer
A drop-in client that mirrors the Supabase SDK interface so existing code needs only an import swap:

```typescript
// Detects mode from VITE_BACKEND_MODE env var
// "supabase" → uses existing supabase client (default)
// "local" → uses fetch-based client hitting local Express API

export const db = getClient(); // same .from().select().eq() API
```

Key: the abstraction implements a chainable query builder that translates to REST calls against the local API.

### 4. Frontend Import Swap (20 files)
Replace `import { supabase } from "@/integrations/supabase/client"` with `import { db } from "@/lib/apiClient"` across all 20 consuming files. The `db` object exposes the same `.from()`, `.auth`, `.functions.invoke()`, and `.storage` interface.

### 5. Environment & Docker Setup
- `.env.local` with `VITE_BACKEND_MODE=local`, `VITE_API_URL=http://localhost:3001`
- `docker-compose.yml` with PostgreSQL 16 + API server + React dev server
- `local-api-server/.env` with `DATABASE_URL`, `JWT_SECRET`

---

## Edge Function Porting (Deno → Node.js)

All 15 functions are simple HTTP handlers. The port involves:
- Replace `serve()` with Express route handler
- Replace `Deno.env.get()` with `process.env`
- Replace Deno TCP/TLS APIs (in `send-email`) with `nodemailer`
- The LOVABLE_API_KEY-based AI calls become direct API calls using user-configured keys

| Function | Complexity | Notes |
|---|---|---|
| rss-proxy | Low | fetch-based proxy |
| ransomlook-proxy | Low | fetch-based proxy |
| shodan-proxy | Low | fetch-based proxy |
| cve-proxy | Low | fetch-based proxy |
| defender-proxy | Low | fetch-based proxy |
| port-scan | Medium | needs nmap binary (already handled by local-tools-server) |
| analyze-feed | Medium | AI API call, swap to direct OpenAI/Google SDK |
| analyze-scan | Medium | AI API call |
| generate-command | Medium | AI API call |
| generate-scan-report | Medium | AI API call |
| send-email | Medium | replace Deno TCP with nodemailer |
| servicenow-ticket | Low | HTTP POST |
| servicenow-sync | Low | HTTP calls |
| test-connection | Low | HTTP calls |
| watchlist-check | Low | DB query + proxy |

---

## Implementation Order

1. Create `init.sql` + `docker-compose.yml`
2. Build `local-api-server/` with auth, CRUD, and middleware
3. Port all 15 edge functions to Express routes
4. Create `src/lib/apiClient.ts` abstraction
5. Update 20 frontend files with conditional import
6. Add `local-api-server/README.md` with setup instructions

---

## Key Design Decision

The frontend uses a **mode switch** (`VITE_BACKEND_MODE`), so the same codebase supports both Supabase Cloud and local PostgreSQL. No UI changes needed — the abstraction layer handles the routing transparently.

