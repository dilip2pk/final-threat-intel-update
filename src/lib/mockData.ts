import { RssIcon, Shield, AlertTriangle, Clock, Tag } from "lucide-react";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface RssFeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  active: boolean;
  lastFetched: string | null;
  totalItems: number;
}

export interface FeedItem {
  id: string;
  title: string;
  publishedDate: string;
  sourceName: string;
  sourceId: string;
  description: string;
  severity: Severity | null;
  content: string;
  impactedSystems: string[];
  indicators: string[];
  mitigations: string[];
  referenceUrl: string;
  cves: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  keywords: string[];
  severityThreshold: Severity;
  urlPattern: string;
  active: boolean;
}

export const mockSources: RssFeedSource[] = [
  { id: "1", name: "CISA Alerts", url: "https://www.cisa.gov/news.xml", category: "Government", tags: ["cisa", "gov", "advisory"], active: true, lastFetched: "2026-02-20T08:30:00Z", totalItems: 342 },
  { id: "2", name: "NVD CVE Feed", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml", category: "Vulnerability DB", tags: ["nvd", "cve", "vulnerability"], active: true, lastFetched: "2026-02-20T09:00:00Z", totalItems: 1205 },
  { id: "3", name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", category: "Security Blog", tags: ["blog", "news", "analysis"], active: true, lastFetched: "2026-02-20T07:45:00Z", totalItems: 89 },
  { id: "4", name: "Microsoft Security", url: "https://msrc.microsoft.com/blog/feed", category: "Vendor Advisory", tags: ["microsoft", "patch", "advisory"], active: true, lastFetched: "2026-02-20T06:15:00Z", totalItems: 567 },
  { id: "5", name: "Cisco Talos", url: "https://blog.talosintelligence.com/rss/", category: "Threat Intel", tags: ["cisco", "talos", "malware"], active: false, lastFetched: "2026-02-18T12:00:00Z", totalItems: 234 },
  { id: "6", name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", category: "Security Blog", tags: ["news", "hacking", "breach"], active: true, lastFetched: "2026-02-20T09:15:00Z", totalItems: 1891 },
];

export const mockFeedItems: FeedItem[] = [
  {
    id: "f1", title: "Critical RCE Vulnerability in Apache Struts (CVE-2026-1234)", publishedDate: "2026-02-20T08:00:00Z",
    sourceName: "CISA Alerts", sourceId: "1", severity: "critical",
    description: "A critical remote code execution vulnerability has been identified in Apache Struts versions 2.0.0 through 6.3.0. Exploitation allows unauthenticated attackers to execute arbitrary commands.",
    content: "A critical remote code execution (RCE) vulnerability has been discovered in Apache Struts framework...",
    impactedSystems: ["Apache Struts 2.0.0 - 6.3.0", "Web applications using Struts framework"],
    indicators: ["CVE-2026-1234", "POST /struts2-showcase/upload.action", "185.220.101.0/24"],
    mitigations: ["Update to Apache Struts 6.3.1 or later", "Apply WAF rules to block exploit patterns", "Monitor for suspicious POST requests"],
    referenceUrl: "https://www.cisa.gov/alerts/aa26-051a", cves: ["CVE-2026-1234"],
  },
  {
    id: "f2", title: "Microsoft Patch Tuesday: 12 Critical Vulnerabilities Fixed", publishedDate: "2026-02-19T18:00:00Z",
    sourceName: "Microsoft Security", sourceId: "4", severity: "high",
    description: "Microsoft's February 2026 Patch Tuesday addresses 78 vulnerabilities, including 12 rated Critical affecting Windows, Office, and Azure services.",
    content: "Microsoft released security updates addressing 78 vulnerabilities across multiple products...",
    impactedSystems: ["Windows 10/11", "Microsoft Office 365", "Azure Active Directory", "Exchange Server 2019"],
    indicators: ["CVE-2026-0078", "CVE-2026-0092", "CVE-2026-0105"],
    mitigations: ["Apply February 2026 security updates", "Enable automatic updates", "Review MSRC advisory for workarounds"],
    referenceUrl: "https://msrc.microsoft.com/update-guide/2026-Feb", cves: ["CVE-2026-0078", "CVE-2026-0092"],
  },
  {
    id: "f3", title: "New Ransomware Campaign Targets Healthcare Sector", publishedDate: "2026-02-20T06:30:00Z",
    sourceName: "Krebs on Security", sourceId: "3", severity: "high",
    description: "A sophisticated ransomware group dubbed 'MedLock' is actively targeting healthcare organizations using spear-phishing emails with malicious PDF attachments.",
    content: "Security researchers have identified a new ransomware campaign specifically targeting healthcare...",
    impactedSystems: ["Hospital EHR systems", "Medical IoT devices", "Windows-based workstations"],
    indicators: ["medlock[@]protonmail.com", "SHA256: a1b2c3d4e5f6...", "C2: 192.168.45.0/24"],
    mitigations: ["Implement email filtering for malicious PDFs", "Ensure offline backups", "Segment medical device networks"],
    referenceUrl: "https://krebsonsecurity.com/2026/02/medlock-ransomware", cves: [],
  },
  {
    id: "f4", title: "NVD: Multiple CVEs Published for Linux Kernel 6.x", publishedDate: "2026-02-19T14:00:00Z",
    sourceName: "NVD CVE Feed", sourceId: "2", severity: "medium",
    description: "The National Vulnerability Database has published 8 new CVEs affecting Linux Kernel versions 6.0 through 6.7, including privilege escalation and denial of service vulnerabilities.",
    content: "Multiple vulnerabilities have been identified in the Linux kernel...",
    impactedSystems: ["Linux Kernel 6.0 - 6.7", "Ubuntu 22.04+", "RHEL 9", "Debian 12"],
    indicators: ["CVE-2026-2001", "CVE-2026-2002", "CVE-2026-2003"],
    mitigations: ["Update kernel to latest stable release", "Apply vendor-specific patches", "Monitor for local privilege escalation attempts"],
    referenceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-2001", cves: ["CVE-2026-2001", "CVE-2026-2002", "CVE-2026-2003"],
  },
  {
    id: "f5", title: "Zero-Day Exploit Discovered in Popular VPN Software", publishedDate: "2026-02-20T03:00:00Z",
    sourceName: "The Hacker News", sourceId: "6", severity: "critical",
    description: "Security researchers have uncovered an actively exploited zero-day vulnerability in a widely-used enterprise VPN solution, allowing attackers to bypass authentication.",
    content: "A zero-day vulnerability in enterprise VPN software is being actively exploited in the wild...",
    impactedSystems: ["Enterprise VPN Gateway v8.x", "SSL VPN clients"],
    indicators: ["CVE-2026-0001", "GET /remote/login?exploit=1", "45.33.32.0/24"],
    mitigations: ["Disable SSL VPN portal until patch available", "Implement IP allowlisting", "Monitor for unusual VPN login patterns"],
    referenceUrl: "https://thehackernews.com/2026/02/vpn-zero-day.html", cves: ["CVE-2026-0001"],
  },
  {
    id: "f6", title: "Supply Chain Attack Targets NPM Packages", publishedDate: "2026-02-18T22:00:00Z",
    sourceName: "The Hacker News", sourceId: "6", severity: "high",
    description: "A coordinated supply chain attack has compromised several popular NPM packages, injecting credential-stealing malware into developer environments.",
    content: "Multiple popular NPM packages have been compromised in a supply chain attack...",
    impactedSystems: ["Node.js applications", "CI/CD pipelines", "Developer workstations"],
    indicators: ["npm: @fake-scope/utils v2.1.0", "npm: helper-lib v1.5.3"],
    mitigations: ["Audit package.json for compromised packages", "Use lockfiles and checksum verification", "Rotate credentials exposed to CI/CD"],
    referenceUrl: "https://thehackernews.com/2026/02/npm-supply-chain.html", cves: [],
  },
  {
    id: "f7", title: "CISA Adds 3 Vulnerabilities to Known Exploited Catalog", publishedDate: "2026-02-19T10:00:00Z",
    sourceName: "CISA Alerts", sourceId: "1", severity: "medium",
    description: "CISA has added three new vulnerabilities to its Known Exploited Vulnerabilities Catalog, requiring federal agencies to patch by March 5, 2026.",
    content: "The Cybersecurity and Infrastructure Security Agency has added three new vulnerabilities...",
    impactedSystems: ["Adobe ColdFusion", "Citrix NetScaler", "Fortinet FortiOS"],
    indicators: ["CVE-2026-3001", "CVE-2026-3002", "CVE-2026-3003"],
    mitigations: ["Apply vendor patches by March 5, 2026", "Implement compensating controls", "Review CISA KEV catalog regularly"],
    referenceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", cves: ["CVE-2026-3001", "CVE-2026-3002", "CVE-2026-3003"],
  },
  {
    id: "f8", title: "Phishing Kit Leveraging AI-Generated Content Detected", publishedDate: "2026-02-20T01:00:00Z",
    sourceName: "Krebs on Security", sourceId: "3", severity: "low",
    description: "A new phishing kit using AI-generated emails and landing pages has been discovered, making traditional detection methods less effective.",
    content: "Researchers have identified a sophisticated phishing kit that uses generative AI...",
    impactedSystems: ["Email systems", "Web browsers", "Identity providers"],
    indicators: ["Domain: secure-login-verify[.]com", "IP: 103.25.60.0/24"],
    mitigations: ["Deploy AI-based email filtering", "Implement DMARC/DKIM/SPF", "User awareness training"],
    referenceUrl: "https://krebsonsecurity.com/2026/02/ai-phishing-kit", cves: [],
  },
];

export const mockAlertRules: AlertRule[] = [
  { id: "a1", name: "Critical CVE Monitor", keywords: ["CVE", "critical", "RCE", "zero-day"], severityThreshold: "critical", urlPattern: "", active: true },
  { id: "a2", name: "Microsoft Patch Watch", keywords: ["Microsoft", "Patch Tuesday", "Windows"], severityThreshold: "high", urlPattern: "microsoft.com", active: true },
  { id: "a3", name: "Ransomware Tracker", keywords: ["ransomware", "malware", "encryption"], severityThreshold: "medium", urlPattern: "", active: false },
];

export function getSeverityColor(severity: Severity | null): string {
  switch (severity) {
    case "critical": return "text-severity-critical";
    case "high": return "text-severity-high";
    case "medium": return "text-severity-medium";
    case "low": return "text-severity-low";
    default: return "text-severity-info";
  }
}

export function getSeverityBg(severity: Severity | null): string {
  switch (severity) {
    case "critical": return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    case "high": return "bg-severity-high/15 text-severity-high border-severity-high/30";
    case "medium": return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    case "low": return "bg-severity-low/15 text-severity-low border-severity-low/30";
    default: return "bg-severity-info/15 text-severity-info border-severity-info/30";
  }
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
