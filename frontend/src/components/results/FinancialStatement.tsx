import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawnIcon } from "@/components/DrawnIcon";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type FinancialStatement as Statement, type StatementRow } from "@/lib/api";

const quantity = (row: StatementRow, locale: string) =>
  `${row.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} ${row.unit}`;

const PartTable = ({
  part,
  title,
  rows,
  subtotalLabel,
  subtotal,
}: {
  part: string;
  title: string;
  rows: StatementRow[];
  subtotalLabel: string;
  subtotal: number;
}) => {
  const { t, locale } = useLanguage();
  return (
    <section className="space-y-2">
      <h3 className="flex items-baseline gap-2 text-base font-semibold">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">{part}</span>
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-12 p-2.5 text-start font-medium">{t("fin.sno")}</th>
              <th scope="col" className="p-2.5 text-start font-medium">{t("fin.item")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("result.quantity")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("fin.unitPrice")}</th>
              <th scope="col" className="p-2.5 text-end font-medium">{t("fin.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${part}-${row.sno}`} className="border-t border-border/40 even:bg-muted/20">
                  <td className="p-2.5 tabular-nums text-muted-foreground">{row.sno}</td>
                  <td className="p-2.5" lang="en">{row.description}</td>
                  <td className="whitespace-nowrap p-2.5 text-end tabular-nums">{quantity(row, locale)}</td>
                  <td className="whitespace-nowrap p-2.5 text-end tabular-nums">{formatCurrency(row.unit_price)}</td>
                  <td className="whitespace-nowrap p-2.5 text-end font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">{t("fin.noItems")}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/25 bg-primary/5">
              <td colSpan={4} className="p-2.5 text-end font-semibold">{subtotalLabel}</td>
              <td className="whitespace-nowrap p-2.5 text-end font-bold tabular-nums">{formatCurrency(subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};

/** Parts A–C of the cost estimate, as one statement. */
export const FinancialStatement = ({ statement }: { statement: Statement }) => {
  const { t } = useLanguage();
  const contingencyPct = Math.round(statement.contingency_rate * 100);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DrawnIcon name="document" className="h-6 w-6 text-primary" />
          {t("fin.title")}
        </CardTitle>
        <CardDescription>{t("fin.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PartTable
          part="A"
          title={t("fin.partA")}
          rows={statement.materials}
          subtotalLabel={t("fin.materialsSubtotal")}
          subtotal={statement.materials_subtotal}
        />
        <PartTable
          part="B"
          title={t("fin.partB")}
          rows={statement.additional}
          subtotalLabel={t("fin.additionalSubtotal")}
          subtotal={statement.additional_subtotal}
        />

        <section className="space-y-2">
          <h3 className="flex items-baseline gap-2 text-base font-semibold">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">C</span>
            {t("fin.partC")}
          </h3>
          <dl className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
            <div className="flex justify-between gap-4 p-3">
              <dt>{t("fin.materialsSubtotal")} (A)</dt>
              <dd className="tabular-nums">{formatCurrency(statement.materials_subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 p-3">
              <dt>+ {t("fin.additionalSubtotal")} (B)</dt>
              <dd className="tabular-nums">{formatCurrency(statement.additional_subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 p-3">
              <dt>+ {t("fin.contingency", { pct: contingencyPct })}</dt>
              <dd className="tabular-nums">{formatCurrency(statement.contingency)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 bg-gradient-to-r from-primary/10 to-accent/10 p-4">
              <dt className="text-base font-semibold">
                = {t("fin.total")}
                <span className="block text-xs font-normal text-muted-foreground">{t("fin.beforeSubsidy")}</span>
              </dt>
              <dd className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(statement.total_cost)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground" lang="en">{statement.rates_note}</p>
        </section>
      </CardContent>
    </Card>
  );
};
