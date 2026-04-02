## Threat Hunt Module — Implementation Plan

### 1. Database Tables
- `threat_hunts` — Store hunt queries/investigations with status, severity, type
- `threat_hunt_results` — Store IOC matches and findings linked to hunts
- `threat_hunt_playbooks` — Pre-defined hunting playbooks (templates)

### 2. Threat Hunt Page (`/threat-hunt`)
- **Query Builder** — Search across feeds, CVEs, scans, IOCs with filters
- **Playbook Runner** — Execute pre-defined hunting playbooks step-by-step
- **IOC Panel** — Import/manage Indicators of Compromise (IPs, hashes, domains)
- **Results Timeline** — Findings displayed chronologically with severity badges

### 3. Plugin Architecture (Frontend)
- Create a `src/lib/plugins/` registry system where modules self-register
- Each plugin exports: `metadata`, `routes`, `sidebarItems`, `widgets`
- Plugin manifest validates compatibility before loading
- Existing pages already follow this pattern implicitly — formalize it

### 4. Developer Guide (`docs/DEVELOPER-GUIDE.md`)
- How to create a new page/feature in a separate Lovable project
- How to use cross-project tools to port components
- Plugin contract: required exports, naming conventions, DB migration patterns
- Security checklist: RLS policies, input validation, auth requirements
- Testing and integration verification steps

### 5. Route & Sidebar Integration
- Add `/threat-hunt` route to App.tsx
- Add sidebar entry with crosshair icon
