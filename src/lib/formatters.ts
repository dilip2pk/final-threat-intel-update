import { AIAnalysis } from "@/lib/api";
import { SmtpConfig, ServiceNowConfig } from "@/lib/settingsStore";

function splitImpactToBullets(text: string): string[] {
  return text.split(/(?:\n[-•*]\s*|\n\d+[.)]\s*|\n{2,})/).map(s => s.trim()).filter(Boolean);
}

export function formatAnalysisText(title: string, source: string, analysis: AIAnalysis): string {
  return [
    `# ${title}`,
    ``,
    `**Source:** ${source}`,
    `**Severity:** ${analysis.severity?.toUpperCase() || "N/A"}`,
    ``,
    `## Summary`,
    analysis.summary,
    ``,
    `## Impact Analysis`,
    ...splitImpactToBullets(analysis.impact_analysis).map(p => `- ${p}`),
    ``,
    ...(analysis.affected_versions.length > 0
      ? [`## Affected Versions`, ...analysis.affected_versions.map((v) => `- ${v}`), ``]
      : []),
    `## Mitigations & Recommendations`,
    ...analysis.mitigations.map((m) => `- ${m}`),
    ``,
    `## Reference Links`,
    ...analysis.reference_links.map((l) => `- ${l}`),
  ].join("\n");
}

export interface AdvisoryTemplateConfig {
  template: string;
  orgName: string;
  contactEmail: string;
  footerText: string;
  logoUrl: string;
}

export function formatAnalysisHTML(title: string, source: string, analysis: AIAnalysis, templateConfig?: AdvisoryTemplateConfig): string {
  // If a custom template is provided, use it
  if (templateConfig?.template) {
    const impactBullets = splitImpactToBullets(analysis.impact_analysis);
    let html = templateConfig.template;
    html = html.replace(/\{\{org_name\}\}/g, templateConfig.orgName || "Security & Compliance");
    html = html.replace(/\{\{contact_email\}\}/g, templateConfig.contactEmail || "");
    html = html.replace(/\{\{footer_text\}\}/g, templateConfig.footerText || "");
    html = html.replace(/\{\{severity\}\}/g, (analysis.severity || "medium").toUpperCase());
    html = html.replace(/\{\{title\}\}/g, escapeHtml(title));
    html = html.replace(/\{\{source\}\}/g, escapeHtml(source));
    html = html.replace(/\{\{summary\}\}/g, escapeHtml(analysis.summary));
    html = html.replace(/\{\{impact_html\}\}/g, impactBullets.map(p => `<li>${escapeHtml(p)}</li>`).join(""));
    // Conditional versions
    if (analysis.affected_versions.length > 0) {
      html = html.replace(/\{\{#has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "$1");
      html = html.replace(/\{\{\^has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "");
    } else {
      html = html.replace(/\{\{#has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "");
      html = html.replace(/\{\{\^has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "$1");
    }
    html = html.replace(/\{\{versions_html\}\}/g, analysis.affected_versions.map(v => `<li>${escapeHtml(v)}</li>`).join(""));
    html = html.replace(/\{\{mitigations_html\}\}/g, analysis.mitigations.map(m => `<li>${escapeHtml(m)}</li>`).join(""));
    html = html.replace(/\{\{references_html\}\}/g, analysis.reference_links.map(l => `<li><a href="${escapeHtml(l)}" style="color:#e94560;">${escapeHtml(l)}</a></li>`).join(""));
    // Conditional logo
    if (templateConfig.logoUrl) {
      html = html.replace(/\{\{#logo_url\}\}([\s\S]*?)\{\{\/logo_url\}\}/g, "$1");
    } else {
      html = html.replace(/\{\{#logo_url\}\}([\s\S]*?)\{\{\/logo_url\}\}/g, "");
    }
    html = html.replace(/\{\{logo_url\}\}/g, templateConfig.logoUrl || "");
    return html;
  }

  // Default fallback template
  const impactBullets = splitImpactToBullets(analysis.impact_analysis);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 20px; }
  h1 { color: #0f3460; border-bottom: 2px solid #e94560; padding-bottom: 8px; font-size: 20px; }
  h2 { color: #16213e; font-size: 16px; margin-top: 24px; }
  .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; color: white; }
  .severity-critical { background: #dc2626; }
  .severity-high { background: #ea580c; }
  .severity-medium { background: #ca8a04; }
  .severity-low { background: #0d9488; }
  .severity-info { background: #6b7280; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
  a { color: #2563eb; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
</style></head>
<body>
  <h1>Advisory: ${escapeHtml(title)}</h1>
  <p class="meta">Source: ${escapeHtml(source)} · <span class="severity severity-${analysis.severity}">${analysis.severity}</span></p>

  <h2>Summary</h2>
  <p>${escapeHtml(analysis.summary)}</p>

  <h2>Impact Analysis</h2>
  <ul>${impactBullets.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>

  ${analysis.affected_versions.length > 0 ? `
  <h2>Affected Versions</h2>
  <ul>${analysis.affected_versions.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
  ` : ""}

  <h2>Mitigations &amp; Recommendations</h2>
  <ul>${analysis.mitigations.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>

  <h2>Reference Links</h2>
  <ul>${analysis.reference_links.map((l) => `<li><a href="${escapeHtml(l)}">${escapeHtml(l)}</a></li>`).join("")}</ul>

  <div class="footer">Generated by ThreatIntel AI Analysis</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatTicketDescription(analysis: AIAnalysis): string {
  return [
    `## Summary`,
    analysis.summary,
    ``,
    `## Impact Analysis`,
    ...analysis.impact_analysis.split(/(?:\n[-•*]\s*|\n\d+[.)]\s*|\n{2,})/).map(s => s.trim()).filter(Boolean).map(p => `- ${p}`),
    ``,
    ...(analysis.affected_versions.length > 0
      ? [`## Affected Versions`, ...analysis.affected_versions.map((v) => `- ${v}`), ``]
      : []),
    `## Mitigations`,
    ...analysis.mitigations.map((m) => `- ${m}`),
    ``,
    `## References`,
    ...analysis.reference_links.map((l) => `- ${l}`),
  ].join("\n");
}
