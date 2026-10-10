import type { SubsidySummary } from "@/lib/api";

/** Which subsidy the user says applies: none, one of the listed schemes, or an amount they know. */
export type SubsidySelection = { kind: "none" } | { kind: "scheme"; id: string } | { kind: "custom"; amount: number };

export const defaultSelection = (subsidies?: SubsidySummary | null): SubsidySelection =>
  subsidies?.applied_scheme ? { kind: "scheme", id: subsidies.applied_scheme } : { kind: "none" };

/** Indicative amount taken off the gross cost for a selection, never more than the cost itself. */
export const subsidyAmount = (selection: SubsidySelection, subsidies: SubsidySummary | null | undefined, grossCost: number) => {
  let amount = 0;
  if (selection.kind === "scheme") {
    amount = subsidies?.schemes.find((scheme) => scheme.id === selection.id)?.indicative_grant ?? 0;
  } else if (selection.kind === "custom") {
    amount = Number.isFinite(selection.amount) ? selection.amount : 0;
  }
  return Math.max(0, Math.min(amount, grossCost));
};
