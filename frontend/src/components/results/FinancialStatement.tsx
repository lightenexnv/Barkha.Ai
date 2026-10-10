import { motion } from "framer-motion";
import { Receipt } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type FinancialStatement as Statement, type StatementRow } from "@/lib/api";

const CostTable = ({ number, title, rows, subtotalLabel, subtotal }: {
  number: number;
  title: string;
  rows: StatementRow[];
  subtotalLabel: string;
  subtotal: number;
}) => {
  const { t, locale } = useLanguage();
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span>
        {title}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-2.5 text-start font-medium">{t("fin.item")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("result.quantity")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("fin.unitPrice")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("fin.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${number}-${row.sno}`} className="border-t border-border/40">
                  <td className="p-2.5" lang="en">{row.description}</td>
                  <td className="whitespace-nowrap p-2.5 text-end tabular-nums text-muted-foreground">
                    {row.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} {row.unit}
                  </td>
                  <td className="whitespace-nowrap p-2.5 text-end tabular-nums text-muted-foreground">{formatCurrency(row.unit_price)}</td>
                  <td className="whitespace-nowrap p-2.5 text-end font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">{t("fin.noItems")}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/25 bg-primary/5">
              <td colSpan={3} className="p-2.5 text-end font-semibold">{subtotalLabel}</td>
              <td className="whitespace-nowrap p-2.5 text-end font-bold tabular-nums">{formatCurrency(subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};

/** One cost statement: materials, then labour and civil work, then the gross total. */
export const FinancialStatement = ({ statement }: { statement: Statement }) => {
  const { t } = useLanguage();
  const pct = Math.round(statement.contingency_rate * 100);

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="glass-card space-y-5 rounded-2xl p-5 sm:p-6"
      aria-labelledby="cost-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 id="cost-title" className="text-xl font-bold">{t("fin.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("fin.subtitle")}</p>
          </div>
        </div>
        <InfoTip>{statement.rates_note}</InfoTip>
      </div>

      <CostTable number={1} title={t("fin.partA")} rows={statement.materials} subtotalLabel={t("fin.materialsSubtotal")} subtotal={statement.materials_subtotal} />
      <CostTable number={2} title={t("fin.partB")} rows={statement.additional} subtotalLabel={t("fin.additionalSubtotal")} subtotal={statement.additional_subtotal} />

      <dl className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 text-sm">
        <div className="flex justify-between gap-4 p-3">
          <dt>{t("fin.materialsSubtotal")}</dt>
          <dd className="tabular-nums">{formatCurrency(statement.materials_subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4 p-3">
          <dt>{t("fin.additionalSubtotal")}</dt>
          <dd className="tabular-nums">{formatCurrency(statement.additional_subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 p-3">
          <dt className="flex items-center gap-1.5">
            {t("fin.contingency", { pct })}
            <InfoTip>{t("fin.contingencyTip")}</InfoTip>
          </dt>
          <dd className="tabular-nums">{formatCurrency(statement.contingency)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 bg-gradient-to-r from-primary/10 to-accent/10 p-4">
          <dt className="text-base font-semibold">
            {t("fin.total")}
            <span className="block text-xs font-normal text-muted-foreground">{t("fin.beforeSubsidy")}</span>
          </dt>
          <dd className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(statement.total_cost)}</dd>
        </div>
      </dl>
    </motion.section>
  );
};
