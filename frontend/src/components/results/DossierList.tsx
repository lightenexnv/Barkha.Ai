import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type Dossier } from "@/lib/api";
import { cn } from "@/lib/utils";

const scoreTone = (score: number) =>
  score >= 75 ? "text-success" : score >= 50 ? "text-primary" : score >= 30 ? "text-warning" : "text-destructive";

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <span className={cn("relative inline-flex h-12 w-12 shrink-0 items-center justify-center", scoreTone(clamped))}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="text-sm font-bold tabular-nums">{Math.round(clamped)}</span>
    </span>
  );
};

const Section = ({ n, title, children, className }: { n: number; title: string; children: ReactNode; className?: string }) => (
  <section className={cn("space-y-2", className)}>
    <h4 className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{n}</span>
      {title}
    </h4>
    <div className="ps-7 text-sm">{children}</div>
  </section>
);

const BulletList = ({ items, ordered }: { items: string[]; ordered?: boolean }) => {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-1 text-muted-foreground", ordered ? "list-decimal ps-4" : "list-disc ps-4")} lang="en">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
};

const DossierBody = ({ dossier }: { dossier: Dossier }) => {
  const { t, locale } = useLanguage();
  const litres = (value: number) => `${Math.round(value).toLocaleString(locale)} L`;

  return (
    <div className="grid gap-6 pt-2 lg:grid-cols-2">
      <Section n={1} title={t("dossier.solution")}>
        <p className="font-medium" lang="en">{dossier.title}</p>
      </Section>
      <Section n={2} title={t("dossier.mechanism")}>
        <p className="text-muted-foreground" lang="en">{dossier.description}</p>
        <p className="mt-1.5 text-muted-foreground" lang="en">{dossier.mechanism}</p>
      </Section>
      <Section n={3} title={t("dossier.justification")} className="lg:col-span-2">
        <p className="rounded-lg border-s-4 border-primary bg-primary/5 p-3" lang="en">{dossier.justification}</p>
      </Section>
      <Section n={4} title={t("dossier.dimensions")}>
        <dl className="divide-y divide-border/50 rounded-lg border border-border/60">
          {dossier.dimensions.map((dim) => (
            <div key={dim.label} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground" lang="en">{dim.label}</dt>
              <dd className="text-end font-medium tabular-nums" lang="en">{dim.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section n={5} title={t("dossier.materials")}>
        <BulletList items={dossier.bill_of_materials} />
      </Section>
      <Section n={6} title={t("dossier.installation")}>
        <BulletList items={dossier.installation_steps} ordered />
      </Section>
      <Section n={7} title={t("dossier.financial")}>
        <dl className="space-y-1">
          {dossier.financial.breakdown.map((line) => (
            <div key={line.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground" lang="en">{line.label}</dt>
              <dd className="whitespace-nowrap tabular-nums">{formatCurrency(line.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border/60 pt-1.5">
            <dt className="text-muted-foreground">{t("fin.contingencyShort")}</dt>
            <dd className="tabular-nums">{formatCurrency(dossier.financial.contingency)}</dd>
          </div>
          <div className="flex justify-between gap-4 font-semibold">
            <dt>{t("fin.total")}</dt>
            <dd className="tabular-nums text-primary">{formatCurrency(dossier.financial.total_cost)}</dd>
          </div>
        </dl>
      </Section>
      <Section n={8} title={t("dossier.benefits")}>
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-primary/5 p-2">
            <p className="text-sm font-bold tabular-nums">{litres(dossier.benefits.annual_litres_saved)}</p>
            <p className="text-[11px] text-muted-foreground">{t("dossier.saved")}</p>
          </div>
          <div className="rounded-lg bg-accent/10 p-2">
            <p className="text-sm font-bold tabular-nums">{litres(dossier.benefits.annual_recharge_litres)}</p>
            <p className="text-[11px] text-muted-foreground">{t("dossier.recharged")}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-2">
            <p className="text-sm font-bold tabular-nums">{formatCurrency(dossier.benefits.annual_bill_savings)}</p>
            <p className="text-[11px] text-muted-foreground">{t("dossier.billSavings")}</p>
          </div>
        </div>
        <BulletList items={dossier.benefits.summary} />
      </Section>
      <Section n={9} title={t("dossier.maintenance")}>
        <BulletList items={dossier.maintenance} />
      </Section>
      <Section n={10} title={t("dossier.suitability")}>
        <div className="flex items-center gap-3">
          <ScoreRing score={dossier.suitability.score} />
          <div>
            <p className="font-medium" lang="en">{dossier.suitability.label}</p>
            <p className="text-xs text-muted-foreground" lang="en">{dossier.suitability.factors.join(" · ")}</p>
          </div>
        </div>
      </Section>
    </div>
  );
};

/** Engineering dossiers for every option, recommended one first and open. */
export const DossierList = ({ dossiers }: { dossiers: Dossier[] }) => {
  const { t } = useLanguage();
  const ordered = [...dossiers].sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.suitability.score - a.suitability.score);
  const recommended = ordered.find((d) => d.recommended);

  return (
    <Accordion type="multiple" defaultValue={recommended ? [recommended.id] : []} className="space-y-3">
      {ordered.map((dossier) => (
        <AccordionItem
          key={dossier.id}
          value={dossier.id}
          className={cn(
            "glass-card overflow-hidden rounded-2xl border px-5",
            dossier.recommended ? "border-primary/50 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.45)]" : "border-border/60",
          )}
        >
          <AccordionTrigger className="gap-3 py-4 hover:no-underline">
            <span className="flex flex-1 items-center gap-3 text-start">
              <ScoreRing score={dossier.suitability.score} />
              <span className="space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold" lang="en">{dossier.title}</span>
                  {dossier.recommended && <Badge variant="success">{t("dossier.recommended")}</Badge>}
                </span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {t("dossier.summary", {
                    match: dossier.suitability.label,
                    cost: formatCurrency(dossier.financial.total_cost),
                  })}
                </span>
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <DossierBody dossier={dossier} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
