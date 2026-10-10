// Material enquiries to shops: a WhatsApp message that lists the plan's
// materials and quantities (never prices) in the text itself.
import { api, type AssessmentResult, type SiteDetailsInput } from "@/lib/api";

export interface EnquiryPlan {
  input: SiteDetailsInput;
  result: AssessmentResult;
}

/** Materials from the cost statement, without any price fields. */
export const enquiryMaterials = (result: AssessmentResult) =>
  (result.financial_statement?.materials ?? []).map((row) => ({
    item: row.description,
    quantity: `${Number(row.quantity.toFixed(2))} ${row.unit}`.trim(),
  }));

/** The WhatsApp text for one shop (or any shop when no name is given), with the full material list. */
export const enquiryMessage = ({ input, result }: EnquiryPlan, shopName?: string) => {
  const recommended = result.dossiers?.find((d) => d.recommended);
  const place = [input.city, input.district, input.state].filter((p, i, all) => p && all.indexOf(p) === i).join(", ");
  const materials = enquiryMaterials(result);
  const sizes = (recommended?.dimensions ?? []).map((d) => `${d.label}: ${d.value}`);
  const site = [
    input.site_name ? `Site: ${input.site_name}` : "",
    place ? `Location: ${place}` : "",
    `System: ${recommended?.title ?? "Rooftop rainwater harvesting"}`,
    input.roof_area ? `Roof area: ${Math.round(input.roof_area)} sq m${input.roof_material ? ` (${input.roof_material} roof)` : ""}` : "",
    ...sizes,
  ].filter(Boolean);
  return [
    `Hello${shopName ? ` ${shopName}` : ""},`,
    "",
    "I am planning a rooftop rainwater harvesting system and would like a quotation for the materials below.",
    "",
    "*SITE DETAILS*",
    ...site.map((line) => `- ${line}`),
    "",
    `*MATERIALS REQUIRED (${materials.length} items)*`,
    ...materials.map((m, i) => `${i + 1}. ${m.item} - Qty: ${m.quantity}`),
    "",
    "*PLEASE SHARE*",
    "- Rate for each item and the total",
    "- Availability and delivery time",
    "- Brand or grade offered",
    "",
    "Quantities are estimates for this site and may change slightly after a site visit.",
    "",
    "Thank you.",
    "(Sent via Barkha.Ai)",
  ].join("\n");
};

/** Fetch the material sheet PDF as a File (for the separate download button). */
export const materialSheetFile = async (plan: EnquiryPlan) => {
  const { blob, filename } = await api.materialSheet(plan.input, plan.result);
  return new File([blob], filename, { type: "application/pdf" });
};

/** Open WhatsApp with the enquiry text, to the shop's number when known. */
export const sendEnquiry = (plan: EnquiryPlan, shop?: { name?: string; whatsapp?: string }) => {
  const number = (shop?.whatsapp ?? "").replace(/\D/g, "");
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(enquiryMessage(plan, shop?.name))}`, "_blank", "noopener");
};
