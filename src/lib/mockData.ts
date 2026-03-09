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

// Mock data removed - use live data from database/API only

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
