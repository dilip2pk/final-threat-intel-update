import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// IOC extraction regex patterns
const IOC_PATTERNS = {
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|info|biz|xyz|top|ru|cn|tk|ml|ga|cf|gq|cc|pw|club|online|site|tech|space|pro|dev|co|uk|de|fr|in|au|ca|br|jp|kr|it|nl|se|no|fi|dk|pl|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|ie|pt|es|gr|at|ch|be|lu|li|is|mt|cy|mx|ar|cl|pe|ve|ec|uy|py|bo|cr|pa|sv|gt|hn|ni|cu|do|pr|jm|tt|ht|bs|bb|ag|dm|gd|kn|lc|vc|bz|sr|gy)\b/gi,
  hash_md5: /\b[a-fA-F0-9]{32}\b/g,
  hash_sha1: /\b[a-fA-F0-9]{40}\b/g,
  hash_sha256: /\b[a-fA-F0-9]{64}\b/g,
  url: /https?:\/\/[^\s<>"')\]]+/gi,
  cve: /CVE-\d{4}-\d{4,}/gi,
};

// Common false-positive IPs/domains to skip
const WHITELIST = new Set([
  '127.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.0.1', '10.0.0.1',
  'example.com', 'localhost', 'google.com', 'microsoft.com', 'github.com',
  'w3.org', 'schema.org', 'xmlns.com',
]);

interface ExtractedIOC {
  ioc_type: string;
  ioc_value: string;
  context: string;
  confidence: number;
}

function extractIOCs(text: string): ExtractedIOC[] {
  const iocs: ExtractedIOC[] = [];
  const seen = new Set<string>();

  for (const [type, pattern] of Object.entries(IOC_PATTERNS)) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      const value = match[0].toLowerCase().replace(/[.\s]+$/, '');
      const key = `${type}:${value}`;
      if (seen.has(key) || WHITELIST.has(value)) continue;
      seen.add(key);

      // Get surrounding context (50 chars each side)
      const start = Math.max(0, (match.index || 0) - 50);
      const end = Math.min(text.length, (match.index || 0) + value.length + 50);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

      // Confidence based on type
      let confidence = 0.5;
      if (type === 'cve') confidence = 0.95;
      else if (type === 'hash_sha256') confidence = 0.9;
      else if (type === 'hash_sha1') confidence = 0.85;
      else if (type === 'hash_md5') confidence = 0.7;
      else if (type === 'ip') confidence = 0.6;
      else if (type === 'url') confidence = 0.65;
      else if (type === 'domain') confidence = 0.5;

      iocs.push({ ioc_type: type, ioc_value: value, context, confidence });
    }
  }

  return iocs;
}

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThreatIntelProcessor/1.0', Accept: 'text/html, text/plain, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const html = await res.text();
    // Strip HTML tags for IOC extraction
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000); // Limit to 50k chars
  } catch {
    return '';
  }
}

async function analyzeWithAI(title: string, content: string, apiKey: string): Promise<{
  summary: string;
  threat_actors: string[];
  ttps: string[];
  affected_sectors: string[];
  affected_products: string[];
  severity: string;
  model: string;
}> {
  const truncated = content.substring(0, 8000);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a threat intelligence analyst. Analyze the following threat article and extract structured intelligence. Focus on identifying threat actors, TTPs (MITRE ATT&CK), affected sectors, affected products, and overall severity assessment.`
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent:\n${truncated}`
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "report_threat_intel",
          description: "Report extracted threat intelligence from an article",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-3 sentence summary of the threat" },
              threat_actors: { type: "array", items: { type: "string" }, description: "Named threat actors or groups" },
              ttps: { type: "array", items: { type: "string" }, description: "MITRE ATT&CK TTPs (e.g., T1566 Phishing)" },
              affected_sectors: { type: "array", items: { type: "string" }, description: "Industries/sectors affected" },
              affected_products: { type: "array", items: { type: "string" }, description: "Software/hardware products mentioned" },
              severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"], description: "Overall severity" },
            },
            required: ["summary", "severity"],
            additionalProperties: false,
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "report_threat_intel" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    summary: parsed.summary || '',
    threat_actors: parsed.threat_actors || [],
    ttps: parsed.ttps || [],
    affected_sectors: parsed.affected_sectors || [],
    affected_products: parsed.affected_products || [],
    severity: parsed.severity || 'medium',
    model: "google/gemini-3-flash-preview",
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'auto'; // 'auto' processes all feeds, 'manual' processes specific items
    const feedItemIds = body.feed_item_ids || []; // for manual mode
    const feedSourceId = body.feed_source_id; // optional: process specific feed
    const skipAI = body.skip_ai || false;
    const deepScrape = body.deep_scrape !== false; // default true

    // Load feed data
    let feedQuery = sb.from("feed_sources").select("id, name, url, category, active").eq("active", true);
    if (feedSourceId) feedQuery = feedQuery.eq("id", feedSourceId);
    const { data: sources, error: srcErr } = await feedQuery;
    if (srcErr) throw new Error(`Failed to load feeds: ${srcErr.message}`);

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active feeds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch RSS items from each feed
    const allItems: { feedId: string; feedName: string; itemId: string; title: string; link: string; description: string; content: string }[] = [];

    for (const source of sources) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(source.url, {
          headers: { 'User-Agent': 'ThreatIntelProcessor/1.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) continue;

        const xml = await res.text();
        // Simple RSS/Atom item parsing
        const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
          const block = match[1] || match[2] || '';
          const extractTag = (tag: string) => {
            const cdm = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'));
            if (cdm) return cdm[1].trim();
            const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
            return m ? m[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : '';
          };
          const title = extractTag('title').replace(/<[^>]*>/g, '');
          const link = extractTag('link').replace(/<[^>]*>/g, '') || extractTag('guid').replace(/<[^>]*>/g, '');
          const description = extractTag('description').replace(/<[^>]*>/g, '');
          const content = extractTag('content:encoded').replace(/<[^>]*>/g, '') || extractTag('content').replace(/<[^>]*>/g, '');
          const itemId = link || `${title}-${source.id}`;

          if (mode === 'manual' && feedItemIds.length > 0 && !feedItemIds.includes(itemId)) continue;

          allItems.push({ feedId: source.id, feedName: source.name, itemId, title, link, description, content });
        }
      } catch (e) {
        console.error(`Failed to fetch feed ${source.name}:`, e);
      }
    }

    // Check which items have already been processed
    const itemIds = allItems.map(i => i.itemId);
    const { data: processed } = await sb
      .from("threat_intel_processing_log")
      .select("feed_item_id")
      .in("feed_item_id", itemIds.slice(0, 500))
      .eq("status", "completed");

    const processedSet = new Set((processed || []).map(p => p.feed_item_id));
    const toProcess = allItems.filter(i => !processedSet.has(i.itemId));

    let totalIOCs = 0;
    let totalReports = 0;
    let processedCount = 0;

    // Process each item (limit to 20 per run to avoid timeouts)
    for (const item of toProcess.slice(0, 20)) {
      try {
        // Combine available text
        let fullText = `${item.title} ${item.description} ${item.content}`;

        // Deep scrape: fetch the linked article for more content
        if (deepScrape && item.link) {
          const articleContent = await fetchArticleContent(item.link);
          if (articleContent) fullText += ' ' + articleContent;
        }

        // Extract IOCs
        const iocs = extractIOCs(fullText);

        // Upsert IOCs
        for (const ioc of iocs) {
          const { error: upsertErr } = await sb.from("threat_intel_iocs").upsert({
            ioc_type: ioc.ioc_type,
            ioc_value: ioc.ioc_value,
            source_feed_id: item.feedId,
            source_feed_name: item.feedName,
            source_article_url: item.link,
            source_article_title: item.title,
            confidence: ioc.confidence,
            context: ioc.context,
            last_seen: new Date().toISOString(),
          }, {
            onConflict: 'ioc_type,ioc_value',
          });
          if (upsertErr) console.error("IOC upsert error:", upsertErr);
          else totalIOCs++;
        }

        // If no IOCs found and AI is available, do behavioral analysis
        let hasBehavioralReport = false;
        if (iocs.length === 0 && !skipAI && lovableApiKey && fullText.length > 100) {
          try {
            const analysis = await analyzeWithAI(item.title, fullText, lovableApiKey);
            const { error: reportErr } = await sb.from("threat_intel_reports").insert({
              source_feed_id: item.feedId,
              source_feed_name: item.feedName,
              source_article_url: item.link,
              source_article_title: item.title,
              report_type: 'behavioral',
              summary: analysis.summary,
              threat_actors: analysis.threat_actors,
              ttps: analysis.ttps,
              affected_sectors: analysis.affected_sectors,
              affected_products: analysis.affected_products,
              severity: analysis.severity,
              ai_model_used: analysis.model,
            });
            if (reportErr) console.error("Report insert error:", reportErr);
            else {
              totalReports++;
              hasBehavioralReport = true;
            }
          } catch (aiErr) {
            console.error("AI analysis error:", aiErr);
          }
        }

        // Log processing
        await sb.from("threat_intel_processing_log").upsert({
          feed_item_id: item.itemId,
          feed_source_id: item.feedId,
          status: 'completed',
          iocs_extracted: iocs.length,
          has_behavioral_report: hasBehavioralReport,
          processed_at: new Date().toISOString(),
        }, { onConflict: 'feed_item_id,feed_source_id' });

        processedCount++;
      } catch (itemErr) {
        console.error(`Error processing item ${item.itemId}:`, itemErr);
        await sb.from("threat_intel_processing_log").upsert({
          feed_item_id: item.itemId,
          feed_source_id: item.feedId,
          status: 'failed',
          error_message: String(itemErr),
        }, { onConflict: 'feed_item_id,feed_source_id' }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      processed: processedCount,
      remaining: Math.max(0, toProcess.length - 20),
      iocs_extracted: totalIOCs,
      behavioral_reports: totalReports,
      total_feed_items: allItems.length,
      already_processed: processedSet.size,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Threat intel processing error:", error);
    return new Response(JSON.stringify({ error: error.message || "Processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
