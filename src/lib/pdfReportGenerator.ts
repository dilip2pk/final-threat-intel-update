import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Scan, ScanResult } from "@/hooks/useScans";

export interface ReportBranding {
  orgName: string;
  logoUrl: string;
  reportTitle: string;
  headerText: string;
  footerText: string;
  primaryColor: string;
  dateFormat: string;
  includeSections: {
    summary: boolean;
    hostDetails: boolean;
    aiAnalysis: boolean;
    remediation: boolean;
    firewallRules: boolean;
    patchRecommendations: boolean;
  };
}

const defaultBranding: ReportBranding = {
  orgName: "ThreatIntel",
  logoUrl: "",
  reportTitle: "Security Scan Report",
  headerText: "",
  footerText: "Confidential — for authorized personnel only.",
  primaryColor: "#14b8a6",
  dateFormat: "MMM d, yyyy HH:mm",
  includeSections: {
    summary: true,
    hostDetails: true,
    aiAnalysis: true,
    remediation: true,
    firewallRules: true,
    patchRecommendations: true,
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function severityColor(s: string): [number, number, number] {
  switch (s) {
    case "critical": return [239, 68, 68];
    case "high": return [249, 115, 22];
    case "medium": return [234, 179, 8];
    case "low": return [20, 184, 166];
    default: return [107, 114, 128];
  }
}

export async function generatePDFReport(
  scan: Scan,
  results: ScanResult[],
  branding?: Partial<ReportBranding>
): Promise<void> {
  const b = { ...defaultBranding, ...branding, includeSections: { ...defaultBranding.includeSections, ...branding?.includeSections } };
  const primary = hexToRgb(b.primaryColor);
  const analysis = scan.ai_analysis as any;
  const summary = scan.result_summary as any;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 0;

  // Helper: add footer on each page
  const addFooter = () => {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(b.footerText, margin, pageHeight - 8);
      doc.text(`${b.orgName} © ${new Date().getFullYear()}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    }
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ─── Header ───
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`${b.orgName} — ${b.reportTitle}`, margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Target: ${scan.target}  |  Generated: ${new Date().toLocaleString()}`, margin, 28);
  if (b.headerText) {
    doc.setFontSize(8);
    doc.text(b.headerText, pageWidth - margin, 28, { align: "right" });
  }

  // ─── Meta bar ───
  y = 42;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 36, pageWidth, 18, "F");
  doc.setTextColor(100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const metaItems = [
    `Scan Type: ${scan.scan_type}`,
    `Started: ${scan.started_at ? new Date(scan.started_at).toLocaleString() : "N/A"}`,
    `Completed: ${scan.completed_at ? new Date(scan.completed_at).toLocaleString() : "N/A"}`,
    `Status: ${scan.status}`,
  ];
  if (analysis?.overall_risk_score) metaItems.push(`Risk: ${analysis.overall_risk_score.toUpperCase()}`);
  doc.text(metaItems.join("    |    "), margin, 47);
  y = 58;

  // ─── Summary ───
  if (b.includeSections.summary && summary) {
    doc.setTextColor(...primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Scan Summary", margin, y);
    y += 3;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const summaryData = [
      ["Total Hosts", String(summary.total_hosts || 0)],
      ["Hosts Up", String(summary.hosts_up || 0)],
      ["Hosts Down", String(summary.hosts_down || 0)],
      ["Open Ports", String(summary.total_open_ports || 0)],
      ["Ports Scanned", String(summary.ports_scanned || 0)],
    ];

    const colWidth = (pageWidth - 2 * margin) / summaryData.length;
    summaryData.forEach(([label, value], i) => {
      const x = margin + i * colWidth;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 1, y, colWidth - 2, 20, 2, 2, "F");
      doc.setTextColor(...primary);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + colWidth / 2, y + 10, { align: "center" });
      doc.setTextColor(100);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + colWidth / 2, y + 17, { align: "center" });
    });
    y += 28;
  }

  // ─── Host & Port Details ───
  if (b.includeSections.hostDetails && results.length > 0) {
    checkPage(30);
    doc.setTextColor(...primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Host & Port Details", margin, y);
    y += 3;
    doc.setDrawColor(...primary);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const tableData: string[][] = [];
    for (const r of results) {
      const ports = (r.ports || []).filter((p: any) => p.state === "open");
      if (ports.length === 0) {
        tableData.push([r.host, r.host_status, "—", "—", "—", "No open ports"]);
      } else {
        ports.forEach((p: any, i: number) => {
          tableData.push([
            i === 0 ? r.host : "",
            i === 0 ? r.host_status : "",
            String(p.port),
            p.protocol || "tcp",
            p.service || "",
            p.version || "—",
          ]);
        });
      }
    }

    autoTable(doc, {
      startY: y,
      head: [["Host", "Status", "Port", "Protocol", "Service", "Version/Banner"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: primary, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── AI Analysis ───
  if (b.includeSections.aiAnalysis && analysis) {
    checkPage(40);
    doc.setTextColor(...primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AI Security Analysis", margin, y);
    y += 3;
    doc.setDrawColor(...primary);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    if (analysis.overall_risk_score) {
      const riskColor = severityColor(analysis.overall_risk_score);
      doc.setFillColor(...riskColor);
      doc.roundedRect(margin, y, 35, 8, 2, 2, "F");
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${analysis.overall_risk_score.toUpperCase()} RISK`, margin + 17.5, y + 5.5, { align: "center" });
      y += 14;
    }

    if (analysis.executive_summary) {
      doc.setTextColor(50);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(analysis.executive_summary, pageWidth - 2 * margin);
      checkPage(lines.length * 4 + 5);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 6;
    }

    if (analysis.risk_assessment) {
      checkPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Risk Assessment", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(analysis.risk_assessment, pageWidth - 2 * margin);
      checkPage(lines.length * 4 + 5);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 6;
    }

    // Technical findings
    if (analysis.technical_findings?.length > 0) {
      checkPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Technical Findings", margin, y);
      y += 6;

      for (const f of analysis.technical_findings) {
        checkPage(25);
        const fColor = severityColor(f.severity);
        doc.setDrawColor(...fColor);
        doc.setLineWidth(1);
        doc.line(margin, y, margin, y + 12);
        doc.setFillColor(...fColor);
        doc.roundedRect(margin + 3, y, 18, 5, 1, 1, "F");
        doc.setTextColor(255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(f.severity.toUpperCase(), margin + 12, y + 3.5, { align: "center" });
        doc.setTextColor(50);
        doc.setFontSize(8);
        doc.text(f.finding || "", margin + 24, y + 3.5);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(80);
        const detailLines = doc.splitTextToSize(f.details || "", pageWidth - 2 * margin - 5);
        doc.text(detailLines, margin + 3, y);
        y += detailLines.length * 3.5 + 6;
      }
    }
  }

  // ─── Remediation ───
  if (b.includeSections.remediation && analysis?.remediation_recommendations?.length > 0) {
    checkPage(20);
    doc.setTextColor(...primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Remediation Recommendations", margin, y);
    y += 3;
    doc.setDrawColor(...primary);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    for (const r of analysis.remediation_recommendations) {
      checkPage(15);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 14, 2, 2, "F");
      doc.setTextColor(r.priority === "immediate" ? 239 : r.priority === "short-term" ? 249 : 20, r.priority === "immediate" ? 68 : r.priority === "short-term" ? 115 : 184, r.priority === "immediate" ? 68 : r.priority === "short-term" ? 22 : 166);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(r.priority?.toUpperCase() || "", margin + 3, y + 4);
      doc.setTextColor(50);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const recLines = doc.splitTextToSize(r.recommendation || "", pageWidth - 2 * margin - 6);
      doc.text(recLines, margin + 3, y + 9);
      y += Math.max(14, recLines.length * 3.5 + 10) + 3;
    }
  }

  // ─── Firewall Rules ───
  if (b.includeSections.firewallRules && analysis?.firewall_rules?.length > 0) {
    checkPage(20);
    doc.setTextColor(...primary);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Firewall Hardening", margin, y);
    y += 6;
    doc.setTextColor(50);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const rule of analysis.firewall_rules) {
      checkPage(8);
      doc.text(`• ${rule}`, margin + 3, y);
      y += 4.5;
    }
    y += 5;
  }

  // ─── Patch Recommendations ───
  if (b.includeSections.patchRecommendations && analysis?.patch_recommendations?.length > 0) {
    checkPage(20);
    doc.setTextColor(...primary);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Patch Recommendations", margin, y);
    y += 6;
    doc.setTextColor(50);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const rec of analysis.patch_recommendations) {
      checkPage(8);
      doc.text(`• ${rec}`, margin + 3, y);
      y += 4.5;
    }
  }

  addFooter();
  doc.save(`scan-report-${scan.id.slice(0, 8)}.pdf`);
}
