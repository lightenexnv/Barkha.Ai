// Shareable plans: a link that rebuilds the plan from its inputs, and a
// WhatsApp message that carries the headline numbers and the link.
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";
import { tankersPerYear } from "@/lib/saral";

// Only what is needed to recompute the plan; keeps links short
const SHARED_KEYS = [
  "site_name", "latitude", "longitude", "roof_area", "roof_material", "roof_condition", "soil_type",
  "annual_rainfall", "monthly_rainfall", "rainfall_source", "rainfall_period", "city", "district", "state",
  "water_demand", "water_tariff", "first_flush_mm",
] as const;

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Link that reopens this plan on any phone, recomputed from its inputs. */
export const planLink = (input: SiteDetailsInput) => {
  const compact = Object.fromEntries(SHARED_KEYS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  if (Array.isArray(compact.monthly_rainfall)) {
    compact.monthly_rainfall = (compact.monthly_rainfall as number[]).map((v) => Math.round(v * 10) / 10);
  }
  return `${window.location.origin}/assess?plan=${toBase64Url(JSON.stringify(compact))}`;
};

/** Inputs from a shared link, or null when the link is broken. */
export const readPlanLink = (value: string): SiteDetailsInput | null => {
  try {
    const data = JSON.parse(fromBase64Url(value)) as Partial<SiteDetailsInput>;
    const ok =
      typeof data.latitude === "number" && typeof data.longitude === "number" &&
      typeof data.roof_area === "number" && data.roof_area > 0 &&
      typeof data.annual_rainfall === "number" && typeof data.roof_material === "string" && typeof data.soil_type === "string";
    if (!ok) return null;
    return { site_name: "Shared plan", roof_condition: "good", water_demand: 0, ...data } as SiteDetailsInput;
  } catch {
    return null;
  }
};

/** Plain-English WhatsApp message with the key numbers and the plan link. */
export const shareMessage = (input: SiteDetailsInput, result: AssessmentResult, headline?: string) => {
  const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
  const total = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const savings = result.savings_analysis.annual_cost_savings;
  const lines = [
    headline ?? `🌧️ Rainwater plan for ${input.site_name}`,
    "",
    `💧 Roof collects about ${Math.round(result.harvestable_volume * 1000).toLocaleString("en-IN")} litres a year (~${tankersPerYear(result.harvestable_volume)} tankers)`,
    savings > 0 ? `💰 Saves about ${rupees(result.savings_analysis.monthly_savings)} a month` : "🌱 Recharges the groundwater under your home",
    `🏗️ Estimated cost ${rupees(total)}${savings > 0 ? `, pays back in about ${(total / savings).toFixed(0)} years` : ""}`,
    "",
    `See the full plan: ${planLink(input)}`,
    "— Barkha.Ai",
  ];
  return lines.join("\n");
};

export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
