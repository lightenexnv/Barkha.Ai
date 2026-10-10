// Shareable plans: a concise link that rebuilds the plan from its inputs,
// and a clean, personal WhatsApp message mentioning the creator.
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";
import { tankersPerYear } from "@/lib/saral";

const getBaseOrigin = () => {
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    !window.location.origin.includes("localhost") &&
    !window.location.origin.includes("127.0.0.1")
  ) {
    return window.location.origin;
  }
  return "https://barkha-ai.vercel.app";
};

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value: string): string => {
  let cleaned = decodeURIComponent(value).trim();
  cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  while (cleaned.length % 4) {
    cleaned += "=";
  }
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Generates a concise, short link that reopens this plan on any phone.
 * Encodes only critical numbers in a short array tuple (~110 chars total URL).
 */
export const planLink = (input: SiteDetailsInput, senderName?: string) => {
  const base = getBaseOrigin();
  const compact = [
    Number(input.latitude?.toFixed(4) ?? 0),
    Number(input.longitude?.toFixed(4) ?? 0),
    Math.round(input.roof_area || 0),
    input.roof_material || "concrete",
    input.soil_type || "loamy",
    Math.round(input.annual_rainfall || 800),
    input.site_name || "",
    input.city || "",
    senderName || "",
    input.water_tariff || 50,
    input.water_demand || 0,
  ];

  return `${base}/assess?p=${toBase64Url(JSON.stringify(compact))}`;
};

/**
 * Decodes inputs from either the new short link (?p=...) or legacy verbose link (?plan=...).
 */
export const readPlanLink = (value: string): (SiteDetailsInput & { shared_by?: string }) | null => {
  try {
    const raw = fromBase64Url(value);
    const data = JSON.parse(raw);

    // Format 1: New compact array tuple [lat, lng, area, mat, soil, rain, site, city, sender, tariff, demand]
    if (Array.isArray(data)) {
      const [lat, lng, area, mat, soil, rain, siteName, city, sender, tariff, demand] = data;
      const ok = typeof lat === "number" && typeof lng === "number" && typeof area === "number" && area > 0;
      if (!ok) return null;

      const input: SiteDetailsInput & { shared_by?: string } = {
        site_name: siteName || (city ? `Home in ${city}` : "Shared Rainwater Plan"),
        latitude: Number(lat),
        longitude: Number(lng),
        roof_area: Number(area),
        roof_material: String(mat || "concrete"),
        roof_condition: "good",
        soil_type: String(soil || "loamy"),
        annual_rainfall: Number(rain || 800),
        water_demand: Number(demand ?? 0),
        water_tariff: Number(tariff ?? 50),
        first_flush_mm: 1.5,
        city: city || "",
        shared_by: sender || "Neil Verma",
      };
      return input;
    }

    // Format 2: Legacy full JSON dictionary (e.g. from ?plan=...)
    if (data && typeof data === "object") {
      const ok =
        typeof data.latitude === "number" &&
        typeof data.longitude === "number" &&
        typeof data.roof_area === "number" &&
        data.roof_area > 0;
      if (!ok) return null;

      return {
        site_name: data.site_name || "Shared plan",
        roof_condition: data.roof_condition || "good",
        water_demand: data.water_demand ?? 0,
        water_tariff: data.water_tariff ?? 50,
        first_flush_mm: data.first_flush_mm ?? 1.5,
        shared_by: (data as { shared_by?: string }).shared_by || "Neil Verma",
        ...data,
      } as SiteDetailsInput & { shared_by?: string };
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Generates an elegant, concise WhatsApp message mentioning the person,
 * key stats, and an ultra-short direct link.
 */
export const shareMessage = (
  input: SiteDetailsInput,
  result: AssessmentResult,
  headlineOrSender?: string,
  explicitSender?: string,
) => {
  const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
  const total = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const savings = result.savings_analysis.annual_cost_savings;
  const litres = Math.round(result.harvestable_volume * 1000).toLocaleString("en-IN");
  const tankers = tankersPerYear(result.harvestable_volume);

  // Resolve sender name
  let senderName = explicitSender;
  let customHeadline: string | undefined;

  if (headlineOrSender) {
    if (headlineOrSender.includes("\n")) {
      customHeadline = headlineOrSender;
    } else if (!senderName) {
      senderName = headlineOrSender;
    }
  }

  if (!senderName && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("barkha_auth_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.name) senderName = u.name;
      }
    } catch {
      // No stored profile; fall back to the default sender below
    }
  }

  // Default to Neil Verma
  if (!senderName) senderName = "Neil Verma";

  const shortLink = planLink(input, senderName);
  const locationTag = [input.city, input.district].filter(Boolean).join(", ");
  const siteDesc = input.site_name
    ? `${input.site_name}${locationTag && !input.site_name.includes(locationTag) ? ` (${locationTag})` : ""}`
    : locationTag || "Rainwater Harvesting Plan";

  const lines = [
    customHeadline?.trim() ?? `*Barkha.AI Rainwater Harvesting Plan*`,
    `*Prepared by:* ${senderName}`,
    `*Property:* ${siteDesc}`,
    "",
    `*Annual Harvest:* ${litres} L/year (~${tankers} tankers)`,
    savings > 0
      ? `*Savings:* ${rupees(result.savings_analysis.monthly_savings)}/mo (Payback: ~${(total / savings).toFixed(0)} yrs)`
      : `*Recharge:* Direct groundwater infiltration`,
    `*Est. Setup:* ${rupees(total)}`,
    "",
    `*View Full Plan:*`,
    shortLink,
  ];

  return lines.join("\n");
};

export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
