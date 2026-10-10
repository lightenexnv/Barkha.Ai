// Last-resort reports built in the browser when the report server cannot be
// reached, so a download button never ends in nothing. Values are metric and
// labels are English to match the server-generated reports.
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";

export interface ReportData {
  site: Partial<SiteDetailsInput>;
  result: Partial<AssessmentResult>;
}

const num = (value: unknown, digits = 2) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: digits }) : "N/A";
};
const rupees = (value: unknown) => `Rs. ${num(value, 0)}`;
const text = (value: unknown) => (value === undefined || value === null || value === "" ? "N/A" : String(value));
const title = (value: unknown) => text(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface Section {
  heading: string;
  rows: [string, string][];
}

const sectionsFor = ({ site, result }: ReportData): Section[] => {
  const sections: Section[] = [
    {
      heading: "Site Details",
      rows: [
        ["Site Name", text(site.site_name)],
        ["Location", site.latitude !== undefined ? `${num(site.latitude, 6)}, ${num(site.longitude, 6)}` : "N/A"],
        ["Roof Area", `${num(site.roof_area)} m²`],
        ["Roof Material", title(site.roof_material)],
        ["Roof Condition", title(site.roof_condition)],
        ["Soil Type", title(site.soil_type)],
        ["Annual Rainfall", `${num(site.annual_rainfall)} mm`],
        ["Daily Water Demand", `${num(site.water_demand)} L/day`],
      ],
    },
    {
      heading: "Assessment Results",
      rows: [
        ["Harvestable Volume", `${num(result.harvestable_volume)} m³/year`],
        ["Recommended System", title(result.recommended_option)],
      ],
    },
  ];

  const storage = result.storage_recommendation;
  const recharge = result.recharge_recommendation;
  if (storage || recharge) {
    sections.push({
      heading: "Technical Design",
      rows: [
        ...(storage
          ? ([
              ["Required Storage", `${num(storage.required_volume)} m³`],
              ["Recommended Storage", `${num(storage.recommended_volume)} m³`],
              ["Storage Duration", `${num(storage.storage_days, 0)} days`],
            ] as [string, string][])
          : []),
        ...(recharge
          ? ([
              ["Recharge Pit", `${num(recharge.recharge_pit?.diameter)} m dia × ${num(recharge.recharge_pit?.depth)} m deep`],
              [
                "Recharge Trench",
                `${num(recharge.recharge_trench?.length)} × ${num(recharge.recharge_trench?.width)} × ${num(recharge.recharge_trench?.depth)} m`,
              ],
              ["Infiltration Rate", `${num(recharge.infiltration_rate)} mm/hr`],
              ["Suitability Score", `${num(recharge.suitability_score, 1)}/10`],
            ] as [string, string][])
          : []),
      ],
    });
  }

  if (result.cost_analysis) {
    sections.push({
      heading: "Cost Analysis",
      rows: Object.entries(result.cost_analysis).map(([key, value]) => [title(key), rupees(value)]),
    });
  }

  if (result.savings_analysis) {
    sections.push({
      heading: "Savings Analysis",
      rows: [
        ["Annual Water Saved", `${num(result.savings_analysis.annual_water_saved)} m³`],
        ["Annual Cost Savings", rupees(result.savings_analysis.annual_cost_savings)],
        ["Monthly Savings", rupees(result.savings_analysis.monthly_savings)],
        ["Water Tariff Used", `Rs. ${num(result.savings_analysis.water_tariff_used)}/m³`],
        ["Payback Period", `${text(result.payback_period)} years`],
      ],
    });
  }

  if (result.bill_of_quantities?.items?.length) {
    sections.push({
      heading: "Bill of Quantities",
      rows: [
        ...result.bill_of_quantities.items.map(
          (item) => [`${item.item} (${item.quantity})`, rupees(item.amount)] as [string, string],
        ),
        ["Total", rupees(result.bill_of_quantities.total_cost)],
      ],
    });
  }

  return sections;
};

const generatedAt = () => new Date().toLocaleString("en-IN");

export const buildTextReport = (data: ReportData): string => {
  const rule = "=".repeat(72);
  const lines = [rule, "RAINWATER HARVESTING ASSESSMENT REPORT", rule];
  if (data.result.assessment_id) lines.push(`Assessment ID: ${data.result.assessment_id}`);
  lines.push(`Generated on: ${generatedAt()} (offline copy)`, "");

  for (const section of sectionsFor(data)) {
    lines.push(section.heading.toUpperCase(), "-".repeat(40));
    for (const [label, value] of section.rows) lines.push(`${label}: ${value}`);
    lines.push("");
  }

  if (data.result.safety_checks?.length) {
    lines.push("SAFETY CHECKS & WARNINGS", "-".repeat(40));
    for (const check of data.result.safety_checks) lines.push(`• ${check}`);
    lines.push("");
  }

  lines.push(rule, "END OF REPORT", rule);
  return lines.join("\n");
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export const buildPrintableHtml = (data: ReportData): string => {
  const sections = sectionsFor(data)
    .map(
      (section) => `
        <h2>${escapeHtml(section.heading)}</h2>
        <table>${section.rows
          .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
          .join("")}</table>`,
    )
    .join("");
  const checks = data.result.safety_checks?.length
    ? `<h2>Safety &amp; Compliance</h2><ul>${data.result.safety_checks
        .map((check) => `<li>${escapeHtml(check)}</li>`)
        .join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>RTRWH Assessment - ${escapeHtml(text(data.site.site_name))}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #10233a; margin: 32px; }
  h1 { color: #0058b8; margin: 0 0 4px; font-size: 22px; }
  .meta { color: #5a6b80; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 15px; margin: 22px 0 8px; color: #0058b8; border-bottom: 1px solid #cfe0f3; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e6eef8; }
  th { width: 45%; font-weight: 500; color: #3c4f66; }
  li { font-size: 13px; margin-bottom: 4px; }
  @page { margin: 16mm; }
</style>
</head>
<body>
  <h1>Rainwater Harvesting Assessment Report</h1>
  <div class="meta">Barkha.AI · Generated ${escapeHtml(generatedAt())}${
    data.result.assessment_id ? ` · ID ${escapeHtml(data.result.assessment_id)}` : ""
  }</div>
  ${sections}
  ${checks}
</body>
</html>`;
};

/**
 * Open the browser print dialog for a report, from which the user can save a
 * PDF. Uses a hidden iframe because a popup opened after an await is blocked.
 */
export const printReport = (data: ReportData) =>
  new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      reject(new Error("Could not open the print view"));
      return;
    }
    doc.open();
    doc.write(buildPrintableHtml(data));
    doc.close();

    // Give the frame a moment to lay out before printing; remove it afterwards
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
