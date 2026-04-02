# 🧩 ThreatIntel — Developer Guide

How to build and integrate new features/pages into ThreatIntel, whether working in the same codebase or a separate Lovable project.

---

## Architecture Overview

```
src/
├── lib/plugins/          ← Plugin registry & type contracts
│   ├── types.ts          ← PluginDefinition, PluginRoute, PluginWidget
│   ├── registry.ts       ← Singleton PluginRegistry class
│   └── index.ts          ← Public API re-exports
├── lib/db/               ← Database abstraction layer
│   ├── config.ts         ← Provider toggle (supabase / postgrest)
│   ├── functions.ts      ← Edge function invocation
│   └── index.ts
├── pages/                ← Each page = 1 file
├── hooks/                ← Data hooks (React Query + Supabase client)
├── components/           ← Shared UI components
└── integrations/supabase ← Auto-generated client & types (DO NOT EDIT)
```

---

## Adding a New Page (Same Codebase)

### 1. Create the Page Component

```tsx
// src/pages/MyFeature.tsx
import { AppLayout } from "@/components/AppLayout";

export default function MyFeature() {
  return (
    <AppLayout>
      <h1>My Feature</h1>
    </AppLayout>
  );
}
```

### 2. Add a Data Hook (if needed)

```tsx
// src/hooks/useMyFeature.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyFeature() {
  return useQuery({
    queryKey: ["my-feature"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_table")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### 3. Register the Route

Add to `src/App.tsx`:
```tsx
import MyFeature from "./pages/MyFeature";

// In AppRoutes:
<Route path="/my-feature" element={<MyFeature />} />
```

### 4. Add Sidebar Entry

In `src/components/AppSidebar.tsx`, add to `navItems`:
```tsx
{ to: "/my-feature", icon: SomeIcon, label: "My Feature", adminOnly: false },
```

### 5. Database Migration

If your feature needs new tables, create a migration SQL file and apply it.

---

## Plugin System

The plugin system (`src/lib/plugins/`) lets modules self-register routes, widgets, and metadata.

### Plugin Contract

Every plugin must export a `PluginDefinition`:

```typescript
import type { PluginDefinition } from "@/lib/plugins";

const myPlugin: PluginDefinition = {
  metadata: {
    id: "my-plugin",           // unique, kebab-case
    name: "My Plugin",
    version: "1.0.0",
    description: "What it does",
    category: "hunting",       // hunting | recon | network | vuln | forensics | reporting | integration | misc
    requires: [],              // IDs of other plugins this depends on
  },
  routes: [
    {
      path: "/my-plugin",
      component: MyPluginPage,
      label: "My Plugin",
      icon: "Crosshair",
      adminOnly: false,
    },
  ],
  widgets: [
    {
      id: "my-widget",
      component: MyWidget,
      slots: ["dashboard"],    // Where this widget can appear
      defaultSize: "md",
    },
  ],
  onActivate: async () => { /* init logic */ },
  onDeactivate: async () => { /* cleanup */ },
};
```

### Registering a Plugin

```typescript
import { pluginRegistry } from "@/lib/plugins";

const result = pluginRegistry.register(myPlugin);
if (!result.valid) console.error(result.errors);
```

---

## Building Features in Separate Lovable Projects

Developers can build features in their own Lovable workspace, then integrate via cross-project copy or manual merge.

### Step-by-Step Workflow

1. **Create a new Lovable project** for your feature
2. **Follow the plugin contract** — export `PluginDefinition` from your main module
3. **Use the same tech stack**: React 18, TypeScript, Tailwind CSS, shadcn/ui, React Query
4. **Use the same DB patterns**: Supabase client, RLS policies, `useQuery`/`useMutation`
5. **Test independently** with mock data
6. **Submit for integration** — provide:
   - Component files (pages, hooks, components)
   - Database migration SQL
   - Plugin definition file
   - README with setup instructions

### File Naming Convention

```
src/plugins/my-feature/
├── index.ts              ← Plugin definition + registration
├── pages/
│   └── MyFeaturePage.tsx
├── hooks/
│   └── useMyFeature.ts
├── components/
│   └── MyWidget.tsx
└── README.md
```

### Integration Checklist

Before submitting a feature for integration:

- [ ] Follows `PluginDefinition` contract
- [ ] Uses semantic Tailwind tokens (no hardcoded colors)
- [ ] All DB tables have RLS policies
- [ ] Input validation on all forms (Zod or equivalent)
- [ ] No direct imports from `src/integrations/supabase/types.ts` (use your own types)
- [ ] Works with both light and dark themes
- [ ] Responsive (mobile-friendly)
- [ ] No `console.log` in production code
- [ ] No secrets/API keys in source code

---

## Database Patterns

### Creating Tables

Always include:
- `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()` (with trigger)
- RLS enabled + policies

### RLS Policy Pattern

```sql
-- Public read
CREATE POLICY "Anyone can read my_table"
  ON public.my_table FOR SELECT TO public USING (true);

-- Authenticated write
CREATE POLICY "Authenticated can manage my_table"
  ON public.my_table FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Database Abstraction

Use the DB abstraction layer for PostgreSQL compatibility:

```typescript
import { db } from "@/lib/db";
// `db` is the Supabase client — works with both Supabase Cloud and standalone PostgREST
```

---

## Backend Functions (Edge Functions)

For server-side logic, create edge functions in `supabase/functions/`:

```typescript
// supabase/functions/my-function/index.ts
import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Your logic here

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Call from frontend:
```typescript
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { param: "value" },
});
```

---

## Local Tools Server Plugins

For tools that require local system access (like Nmap), extend the `local-tools-server`:

1. Copy `local-tools-server/plugins/_template.js`
2. Implement `metadata`, `healthCheck`, `registerRoutes`
3. Drop in `plugins/` directory — auto-loads on restart

See `local-tools-server/README.md` for details.

---

## Security Checklist

| Area | Requirement |
|------|-------------|
| Auth | Use `useAuth()` hook for role checks |
| RLS | Every table must have RLS enabled |
| Input | Validate all user inputs with Zod |
| XSS | Never use `dangerouslySetInnerHTML` with user content |
| Secrets | Never commit API keys — use edge function secrets |
| SQL | Never execute raw SQL from user input |
| Routes | Admin pages wrapped in `<AdminRoute>` |

---

## Quick Reference

| Task | How |
|------|-----|
| Add a page | Create in `src/pages/`, add route in `App.tsx`, add sidebar in `AppSidebar.tsx` |
| Add a hook | Create in `src/hooks/`, use React Query + Supabase client |
| Add a DB table | Create SQL migration, add RLS policies |
| Add an edge function | Create in `supabase/functions/<name>/index.ts` |
| Add a local tool | Create plugin in `local-tools-server/plugins/` |
| Register a plugin | Import `pluginRegistry`, call `.register()` |
