import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

async function callProxy(params: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/rss-proxy`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

Deno.test("CISA KEV: rss-proxy parses feed and populates required fields", async () => {
  const { status, body } = await callProxy({ testUrl: KEV_URL });
  assertEquals(status, 200);
  assert(!body.error, `proxy error: ${body.error}`);
  assertEquals(body.format, "json", "expected JSON format detection");
  assert(body.count > 100, `expected many KEV entries, got ${body.count}`);
  assert(Array.isArray(body.items) && body.items.length > 0, "items missing");

  for (const item of body.items) {
    assert(item.title && item.title.trim().length > 0, "title empty");
    assert(/CVE-\d{4}-\d+/i.test(item.title) || /CVE-\d{4}-\d+/i.test(item.id), `no CVE id in title/id: ${item.title}`);
    assert(item.link && item.link.startsWith("http"), `bad link: ${item.link}`);
    assert(item.pubDate && item.pubDate.length > 0, "pubDate empty (dateAdded)");
    assertEquals(item.category, "KEV");
  }
});

Deno.test("CISA KEV: items have unique CVE ids within a fetch (no duplicate ingestion)", async () => {
  const { body } = await callProxy({ feedUrl: KEV_URL });
  assert(Array.isArray(body.items) && body.items.length > 50);
  const links = body.items.map((i: any) => i.link);
  const unique = new Set(links);
  assertEquals(
    unique.size,
    links.length,
    `duplicate links detected: ${links.length - unique.size} dupes`,
  );
  const ids = body.items.map((i: any) => i.id);
  assertEquals(new Set(ids).size, ids.length, "duplicate ids detected");
});
