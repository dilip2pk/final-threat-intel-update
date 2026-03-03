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

export const mockRansomGroups: RansomGroup[] = [
  { id: "rg1", name: "LockBit 4.0", firstSeen: "2024-06-01", totalVictims: 1847, status: "active", description: "Ransomware-as-a-Service operation, successor to LockBit 3.0" },
  { id: "rg2", name: "BlackCat/ALPHV", firstSeen: "2021-11-01", totalVictims: 523, status: "seized", description: "Rust-based ransomware with triple extortion tactics" },
  { id: "rg3", name: "Cl0p", firstSeen: "2019-02-01", totalVictims: 892, status: "active", description: "Known for exploiting file transfer vulnerabilities" },
  { id: "rg4", name: "Play", firstSeen: "2022-06-01", totalVictims: 634, status: "active", description: "Double extortion ransomware targeting Latin America and Europe" },
  { id: "rg5", name: "8Base", firstSeen: "2023-03-01", totalVictims: 312, status: "active", description: "Targets SMBs with aggressive leak site activity" },
  { id: "rg6", name: "Akira", firstSeen: "2023-03-01", totalVictims: 287, status: "active", description: "Retro-themed leak site, targets VPN vulnerabilities" },
  { id: "rg7", name: "Medusa", firstSeen: "2021-06-01", totalVictims: 418, status: "active", description: "Multi-extortion model with public countdown timers" },
  { id: "rg8", name: "RansomHub", firstSeen: "2024-02-01", totalVictims: 196, status: "active", description: "Emerging RaaS platform with affiliate program" },
];

export const mockLeaks: LeakEntry[] = [
  {
    id: "l1", organization: "Acme Healthcare Systems", groupName: "LockBit 4.0", groupId: "rg1",
    discoveredDate: "2026-02-28T14:00:00Z", publishedDate: "2026-02-27T10:00:00Z",
    country: "United States", sector: "Healthcare",
    dataTypes: ["PII", "Medical Records", "Insurance Data", "SSN"],
    estimatedRecords: 2400000, severity: "critical", status: "confirmed",
    description: "Full patient database exfiltrated including medical records and insurance information.",
    url: "https://ransomlook.io/victim/acme-healthcare"
  },
  {
    id: "l2", organization: "EuroBank Financial Group", groupName: "Cl0p", groupId: "rg3",
    discoveredDate: "2026-02-26T08:00:00Z", publishedDate: "2026-02-25T16:00:00Z",
    country: "Germany", sector: "Finance",
    dataTypes: ["Financial Records", "PII", "Account Numbers"],
    estimatedRecords: 890000, severity: "critical", status: "confirmed",
    description: "Banking customer data leaked via exploited MOVEit vulnerability.",
    url: "https://ransomlook.io/victim/eurobank"
  },
  {
    id: "l3", organization: "TechNova Inc", groupName: "Play", groupId: "rg4",
    discoveredDate: "2026-02-25T12:00:00Z", publishedDate: "2026-02-24T09:00:00Z",
    country: "United States", sector: "Technology",
    dataTypes: ["Source Code", "Employee PII", "API Keys"],
    estimatedRecords: 150000, severity: "high", status: "confirmed",
    description: "Corporate source code repositories and employee data exfiltrated.",
    url: "https://ransomlook.io/victim/technova"
  },
  {
    id: "l4", organization: "National Education Board", groupName: "Medusa", groupId: "rg7",
    discoveredDate: "2026-02-24T18:00:00Z", publishedDate: "2026-02-23T14:00:00Z",
    country: "United Kingdom", sector: "Education",
    dataTypes: ["Student Records", "PII", "Exam Data"],
    estimatedRecords: 3200000, severity: "critical", status: "confirmed",
    description: "Student and faculty records from national education database.",
    url: "https://ransomlook.io/victim/nat-edu-board"
  },
  {
    id: "l5", organization: "GreenEnergy Corp", groupName: "Akira", groupId: "rg6",
    discoveredDate: "2026-02-23T10:00:00Z", publishedDate: "2026-02-22T08:00:00Z",
    country: "Canada", sector: "Energy",
    dataTypes: ["SCADA Configs", "Employee PII", "Financial Data"],
    estimatedRecords: 45000, severity: "high", status: "confirmed",
    description: "Industrial control system configurations and corporate data leaked.",
    url: "https://ransomlook.io/victim/greenenergy"
  },
  {
    id: "l6", organization: "MediCare Plus", groupName: "LockBit 4.0", groupId: "rg1",
    discoveredDate: "2026-02-22T06:00:00Z", publishedDate: "2026-02-21T12:00:00Z",
    country: "Australia", sector: "Healthcare",
    dataTypes: ["Medical Records", "PII", "Billing Data"],
    estimatedRecords: 780000, severity: "high", status: "confirmed",
    description: "Patient billing and medical history data compromised.",
    url: "https://ransomlook.io/victim/medicare-plus"
  },
  {
    id: "l7", organization: "Atlas Manufacturing", groupName: "8Base", groupId: "rg5",
    discoveredDate: "2026-02-20T15:00:00Z", publishedDate: "2026-02-19T11:00:00Z",
    country: "Mexico", sector: "Manufacturing",
    dataTypes: ["Trade Secrets", "Employee PII", "Contracts"],
    estimatedRecords: 62000, severity: "medium", status: "claimed",
    description: "Corporate contracts and proprietary manufacturing processes exposed.",
    url: "https://ransomlook.io/victim/atlas-mfg"
  },
  {
    id: "l8", organization: "CityGov Municipal Services", groupName: "Play", groupId: "rg4",
    discoveredDate: "2026-02-19T20:00:00Z", publishedDate: "2026-02-18T16:00:00Z",
    country: "United States", sector: "Government",
    dataTypes: ["Citizen PII", "Tax Records", "Internal Comms"],
    estimatedRecords: 1500000, severity: "critical", status: "confirmed",
    description: "Municipal citizen records including tax and permit data breached.",
    url: "https://ransomlook.io/victim/citygov"
  },
  {
    id: "l9", organization: "FastShip Logistics", groupName: "RansomHub", groupId: "rg8",
    discoveredDate: "2026-02-18T09:00:00Z", publishedDate: "2026-02-17T14:00:00Z",
    country: "Netherlands", sector: "Logistics",
    dataTypes: ["Shipping Manifests", "Customer PII", "Financial Data"],
    estimatedRecords: 230000, severity: "medium", status: "under_review",
    description: "Supply chain and customer shipping data potentially compromised.",
    url: "https://ransomlook.io/victim/fastship"
  },
  {
    id: "l10", organization: "LegalEdge Partners", groupName: "Cl0p", groupId: "rg3",
    discoveredDate: "2026-02-17T11:00:00Z", publishedDate: "2026-02-16T08:00:00Z",
    country: "United States", sector: "Legal",
    dataTypes: ["Case Files", "Client PII", "Attorney-Client Privileged"],
    estimatedRecords: 95000, severity: "high", status: "confirmed",
    description: "Sensitive legal case files and privileged communications leaked.",
    url: "https://ransomlook.io/victim/legaledge"
  },
  {
    id: "l11", organization: "Nordic Telecom AS", groupName: "LockBit 4.0", groupId: "rg1",
    discoveredDate: "2026-02-15T07:00:00Z", publishedDate: "2026-02-14T10:00:00Z",
    country: "Norway", sector: "Telecom",
    dataTypes: ["Subscriber Data", "Call Records", "PII"],
    estimatedRecords: 4100000, severity: "critical", status: "confirmed",
    description: "Massive subscriber database and call metadata exfiltrated.",
    url: "https://ransomlook.io/victim/nordic-telecom"
  },
  {
    id: "l12", organization: "PharmaVita Labs", groupName: "Medusa", groupId: "rg7",
    discoveredDate: "2026-02-13T16:00:00Z", publishedDate: "2026-02-12T12:00:00Z",
    country: "Switzerland", sector: "Pharmaceutical",
    dataTypes: ["Clinical Trial Data", "Patents", "Employee PII"],
    estimatedRecords: 38000, severity: "high", status: "confirmed",
    description: "Drug trial data and patent applications exposed on leak site.",
    url: "https://ransomlook.io/victim/pharmavita"
  },
  {
    id: "l13", organization: "RetailMax Global", groupName: "Akira", groupId: "rg6",
    discoveredDate: "2026-02-10T14:00:00Z", publishedDate: "2026-02-09T09:00:00Z",
    country: "United States", sector: "Retail",
    dataTypes: ["Customer PII", "Payment Cards", "Purchase History"],
    estimatedRecords: 5600000, severity: "critical", status: "confirmed",
    description: "Customer payment card data and purchase histories compromised.",
    url: "https://ransomlook.io/victim/retailmax"
  },
  {
    id: "l14", organization: "SmartCity Solutions", groupName: "8Base", groupId: "rg5",
    discoveredDate: "2026-02-08T10:00:00Z", publishedDate: "2026-02-07T15:00:00Z",
    country: "Brazil", sector: "Technology",
    dataTypes: ["IoT Configs", "Citizen Data", "Infrastructure Plans"],
    estimatedRecords: 180000, severity: "medium", status: "claimed",
    description: "Smart city infrastructure data and citizen telemetry leaked.",
    url: "https://ransomlook.io/victim/smartcity"
  },
  {
    id: "l15", organization: "Pacific Airlines", groupName: "RansomHub", groupId: "rg8",
    discoveredDate: "2026-02-05T08:00:00Z", publishedDate: "2026-02-04T11:00:00Z",
    country: "Japan", sector: "Aviation",
    dataTypes: ["Passenger PII", "Passport Data", "Flight Records"],
    estimatedRecords: 920000, severity: "high", status: "confirmed",
    description: "Passenger passport and booking data from airline systems.",
    url: "https://ransomlook.io/victim/pacific-airlines"
  },
];

// Timeline data for charts
export const monthlyLeakTrend = [
  { month: "Sep 2025", leaks: 142, records: 28 },
  { month: "Oct 2025", leaks: 168, records: 45 },
  { month: "Nov 2025", leaks: 155, records: 32 },
  { month: "Dec 2025", leaks: 189, records: 61 },
  { month: "Jan 2026", leaks: 201, records: 52 },
  { month: "Feb 2026", leaks: 178, records: 48 },
];

export const sectorBreakdown = [
  { sector: "Healthcare", count: 42, percentage: 23 },
  { sector: "Finance", count: 35, percentage: 19 },
  { sector: "Technology", count: 28, percentage: 15 },
  { sector: "Government", count: 24, percentage: 13 },
  { sector: "Education", count: 18, percentage: 10 },
  { sector: "Manufacturing", count: 15, percentage: 8 },
  { sector: "Retail", count: 12, percentage: 7 },
  { sector: "Other", count: 9, percentage: 5 },
];

export const groupActivity = [
  { name: "LockBit 4.0", victims30d: 48, victims90d: 156 },
  { name: "Cl0p", victims30d: 31, victims90d: 112 },
  { name: "Play", victims30d: 27, victims90d: 89 },
  { name: "Medusa", victims30d: 22, victims90d: 74 },
  { name: "Akira", victims30d: 19, victims90d: 62 },
  { name: "8Base", victims30d: 15, victims90d: 48 },
  { name: "RansomHub", victims30d: 12, victims90d: 34 },
];
