# 🐳 ThreatIntel — Self-Hosting Guide

Deploy ThreatIntel on your own infrastructure with Docker Compose. All data stays on your network.

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Kong (API)  │────▶│  PostgREST   │
│  (Nginx:80)  │     │   Gateway    │     │  (REST API)  │
│  :8080       │     │   :54321     │     └──────┬───────┘
└──────────────┘     │              │────▶│  GoTrue Auth │
                     │              │     │  (Auth API)  │
                     └──────────────┘     └──────┬───────┘
                                                 │
┌──────────────┐     ┌──────────────┐     ┌──────┴───────┐
│  Nmap Server │     │ Tools Server │     │  PostgreSQL  │
│  :3001       │     │  :3002       │     │  :54322      │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 20.10
- [Docker Compose](https://docs.docker.com/compose/install/) ≥ 2.0
- 2GB+ RAM recommended

## Quick Start

### 1. Configure Environment

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` — at minimum change:
- `POSTGRES_PASSWORD` — strong database password
- `JWT_SECRET` — min 32 chars, generate with `openssl rand -base64 32`
- `VITE_SUPABASE_ANON_KEY` — generate a JWT signed with your `JWT_SECRET` with payload `{"role": "anon", "iss": "supabase"}`

### 2. Generate Supabase Keys

You need anon and service_role JWT keys. Use this quick method:

```bash
# Install jwt-cli or use https://supabase.com/docs/guides/self-hosting#api-keys
# Anon key (public, limited access):
echo '{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}' | jwt encode --secret "YOUR_JWT_SECRET"

# Service role key (admin, keep private):
echo '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}' | jwt encode --secret "YOUR_JWT_SECRET"
```

### 3. Start Everything

```bash
docker compose --env-file .env.docker up -d
```

### 4. Access

| Service          | URL                        |
|------------------|----------------------------|
| **Dashboard**    | http://localhost:8080       |
| **API Gateway**  | http://localhost:54321      |
| **Database**     | localhost:54322 (postgres)  |
| **Nmap Server**  | http://localhost:3001       |
| **Tools Server** | http://localhost:3002       |

### 5. Create First Admin User

Sign up through the UI at http://localhost:8080. The first user is automatically assigned the `admin` role.

---

## Services

### PostgreSQL
- Full schema auto-initialized on first boot via `docker/db/init.sql`
- Data persisted in Docker volume `pgdata`
- Connect directly: `psql postgres://postgres:YOUR_PASSWORD@localhost:54322/postgres`

### Nmap Server
- Runs real Nmap binary inside the container
- Has `NET_RAW` + `NET_ADMIN` capabilities for OS detection & SYN scans
- API: `http://localhost:3001/api/health`

### Tools Server
- Plugin-based architecture — drop `.js` files in `plugins/` to add tools
- Nmap plugin included by default
- API: `http://localhost:3002/api/tools`

### Frontend
- Built with Vite, served by Nginx
- SPA routing configured (all routes → index.html)
- Security headers included

---

## Operations

### View Logs
```bash
docker compose logs -f              # All services
docker compose logs -f nmap-server  # Specific service
```

### Restart a Service
```bash
docker compose restart nmap-server
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U postgres postgres > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres postgres
```

### Update / Rebuild
```bash
git pull
docker compose --env-file .env.docker up -d --build
```

### Full Reset (⚠️ destroys data)
```bash
docker compose down -v
docker compose --env-file .env.docker up -d
```

---

## Email Configuration (Optional)

To enable email verification and password reset, configure SMTP in `.env.docker`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_ADMIN_EMAIL=your-email@gmail.com
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833).

Without SMTP, set `GOTRUE_MAILER_AUTOCONFIRM=true` in `docker-compose.yml` to skip email verification.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `nmap: permission denied` | Ensure `cap_add: NET_RAW, NET_ADMIN` in docker-compose |
| Auth not working | Verify `JWT_SECRET` matches across all services |
| Database connection refused | Wait for postgres healthcheck: `docker compose logs postgres` |
| Frontend shows blank page | Check build args: `VITE_SUPABASE_URL` must be accessible from browser |
| Port conflict | Change host ports in `docker-compose.yml` (e.g., `9080:80`) |

---

## Security Notes

- Change all default passwords before exposing to a network
- Use a reverse proxy (Caddy/Nginx) with TLS for production
- Set `NMAP_API_KEY` and `TOOLS_API_KEY` to restrict server access
- Consider network policies to isolate the Nmap container
