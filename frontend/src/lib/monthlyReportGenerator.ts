// Monthly harvest and financial report generator.
// Generates clean print-ready HTML and opens browser print dialog for direct PDF saving.
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";

export interface MonthlyRecord {
  monthIndex: number;
  monthName: string;
  rainMm: number;
  harvestM3: number;
  harvestLitres: number;
  savings: number;
  cumulativeSavings: number;
  status: "Estimated" | "Projected";
}

export interface MonthlyReportData {
  site: Partial<SiteDetailsInput>;
  result: Partial<AssessmentResult>;
  implementedAt: string;
  records: MonthlyRecord[];
  totalHarvestM3: number;
  totalHarvestLitres: number;
  totalSavings: number;
  monthlySavings: number;
  remainingPaybackYears: number | null;
  netCost: number;
}

const escapeHtml = (text: unknown) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatINR = (val: number) => `₹${Math.round(val).toLocaleString("en-IN")}`;

export const buildMonthlyReportHtml = (data: MonthlyReportData): string => {
  const { site, result, implementedAt, records, totalHarvestLitres, totalSavings, remainingPaybackYears, netCost } = data;
  const impDate = new Date(implementedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const reportDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const tableRows = records
    .map(
      (r) => `
    <tr>
      <td style="padding: 10px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${escapeHtml(r.monthName)}</td>
      <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${
          r.status === "Estimated" ? "#dcfce7; color: #15803d" : "#f1f5f9; color: #64748b"
        };">
          ${r.status}
        </span>
      </td>
      <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">${Math.round(r.rainMm)} mm</td>
      <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0284c7;">
        ${r.harvestLitres.toLocaleString("en-IN")} L
      </td>
      <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #16a34a;">
        ${formatINR(r.savings)}
      </td>
      <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
        ${formatINR(r.cumulativeSavings)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Monthly Harvest & Savings Report — ${escapeHtml(site.site_name || "Barkha.AI")}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 26px;
      font-weight: 800;
      color: #0369a1;
      letter-spacing: -0.5px;
    }
    .brand span { color: #06b6d4; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 4px 0 2px 0; }
    .meta { font-size: 13px; color: #64748b; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
    }
    .metric-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-val { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .metric-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-bottom: 2px solid #cbd5e1;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 12px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Barkha<span>.Ai</span></div>
      <div class="title">Monthly Harvest & Water Bill Savings Statement</div>
      <div class="meta">Site: <strong>${escapeHtml(site.site_name || "Property")}</strong> · Implemented: <strong>${escapeHtml(impDate)}</strong></div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 9999px; display: inline-block;">
        VERIFIED SYSTEM
      </div>
      <div class="meta" style="margin-top: 6px;">Generated: ${escapeHtml(reportDate)}</div>
      <div class="meta">ID: ${escapeHtml(result.assessment_id || "N/A")}</div>
    </div>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-label">Estimated Collected So Far</div>
      <div class="metric-val" style="color: #0284c7;">${totalHarvestLitres.toLocaleString("en-IN")} L</div>
      <div class="metric-sub">${(totalHarvestLitres / 1000).toFixed(2)} m³ collected</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Savings</div>
      <div class="metric-val" style="color: #16a34a;">${formatINR(totalSavings)}</div>
      <div class="metric-sub">Water bill reduction</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">System Investment</div>
      <div class="metric-val">${formatINR(netCost)}</div>
      <div class="metric-sub">Net initial structure cost</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Remaining Payback</div>
      <div class="metric-val" style="color: #0369a1;">${
        remainingPaybackYears !== null ? `${remainingPaybackYears.toFixed(1)} yrs` : "N/A"
      }</div>
      <div class="metric-sub">Estimated breakeven</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align: left;">Month</th>
        <th style="text-align: center;">Status</th>
        <th style="text-align: right;">Rainfall</th>
        <th style="text-align: right;">Harvested</th>
        <th style="text-align: right;">Monthly Savings</th>
        <th style="text-align: right;">Cumulative Savings</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <div>Barkha.AI Rooftop Rainwater Harvesting & Artificial Recharge Assessment Platform</div>
    <div>Page 1 of 1 · Confidential Customer Statement</div>
  </div>
</body>
</html>`;
};

/** Opens browser print preview / save as PDF for monthly report */
export const printMonthlyReport = (data: MonthlyReportData): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      reject(new Error("Could not open print iframe"));
      return;
    }
    doc.open();
    doc.write(buildMonthlyReportHtml(data));
    doc.close();

    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        window.setTimeout(() => frame.remove(), 60_000);
      }
    }, 250);
  });
