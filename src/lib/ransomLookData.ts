export interface RansomGroup {
  id: string;
  name: string;
  firstSeen: string;
  totalVictims: number;
  status: "active" | "inactive" | "seized";
  description: string;
}

export interface LeakEntry {
  id: string;
  organization: string;
  groupName: string;
  groupId: string;
  discoveredDate: string;
  publishedDate: string;
  country: string;
  sector: string;
  dataTypes: string[];
  estimatedRecords: number;
  severity: "critical" | "high" | "medium" | "low";
  status: "confirmed" | "claimed" | "under_review";
  description: string;
  url: string;
}

// Mock data removed - use live data from RansomLook API only
