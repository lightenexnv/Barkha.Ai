import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, CloudRain, LogIn, MapPin, RotateCcw, Ruler, Save } from "lucide-react";
import { Icon3D } from "@/components/Icon3D";
import { DrawnIcon, type DrawnIconName } from "@/components/DrawnIcon";
import { ReportDownloadMenu } from "@/components/ReportDownloadMenu";
import { placeLine } from "@/components/assessment/model";
import { DossierList } from "@/components/results/DossierList";
import { FinancialStatement } from "@/components/results/FinancialStatement";
import { SubsidyPanel } from "@/components/results/SubsidyPanel";
import { AssessmentResult as AssessmentResultType, SiteDetailsInput, formatCurrency } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUnits } from "@/context/SettingsContext";
import { buildAssessmentEntry, saveAssessment, useAssessmentHistory } from "@/lib/historyService";
import type { TranslationKey } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface AssessmentResultProps {
  result: AssessmentResultType;
  /** The inputs that produced this result, used for reports and saving. */
  input: SiteDetailsInput;
  onNewAssessment: () => void;
}

const RECOMMENDATION_KEYS: Record<string, TranslationKey> = {
  storage_only: "rec.storage_only",
  recharge_only: "rec.recharge_only",
  hybrid: "rec.hybrid",
  storage_priority_hybrid: "rec.storage_priority_hybrid",
  not_feasible: "rec.not_feasible",
};

const COST_KEYS: Record<string, TranslationKey> = {
  storage_tank_cost: "cost.storage_tank_cost",
  recharge_structure_cost: "cost.recharge_structure_cost",
  piping_cost: "cost.piping_cost",
  filtration_cost: "cost.filtration_cost",
  labor_cost: "cost.labor_cost",
  material_contingency: "cost.material_contingency",
  tax: "cost.tax",
};

export const getRecommendationColor = (recommendation: string) => {
  switch (recommendation) {
    case 'hybrid':
    case 'storage_priority_hybrid':
      return 'success';
    case 'storage_only':
    case 'recharge_only':
      return 'warning';
    case 'not_feasible':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getRecommendationIcon = (recommendation: string): DrawnIconName => {
  switch (recommendation) {
    case 'hybrid':
    case 'storage_priority_hybrid':
    case 'storage_only':
    case 'recharge_only':
      return "tick";
    case 'not_feasible':
      return "cross";
    default:
      return "warning";
  }
};

/** Localized label for a backend recommendation code. */
export const useRecommendationLabel = () => {
  const { t } = useLanguage();
  return (recommendation: string) =>
    RECOMMENDATION_KEYS[recommendation] ? t(RECOMMENDATION_KEYS[recommendation]) : recommendation.replace(/_/g, " ");
};

export const AssessmentResult = ({ result, input, onNewAssessment }: AssessmentResultProps) => {
  const { t } = useLanguage();
  const units = useUnits();
  const recommendationLabel = useRecommendationLabel();
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const history = useAssessmentHistory(user?.id);
  const isSaved = history.some((entry) => entry.id === result.assessment_id);

  const handleSave = () => {
    if (!user) return;
    if (saveAssessment(buildAssessmentEntry(user.id, input, result))) {
      toast({ title: t("result.savedBanner") });
    } else {
      toast({ title: t("report.failed"), variant: "destructive" });
    }
  };

  const recommendationIcon = getRecommendationIcon(result.recommended_option);
  const annualSavings = result.savings_analysis.annual_cost_savings;
  // Prefer the itemised statement total; older saved results only have cost_analysis
  const totalCost = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const payback =
    result.payback_period && result.payback_period !== "N/A"
      ? result.payback_period
      : annualSavings > 0
        ? Math.ceil(totalCost / annualSavings)
        : "—";
  const place = placeLine({ city: input.city ?? "", district: input.district ?? "", state: input.state ?? "" });
  const rainfall = result.hydrology?.annual_rainfall ?? input.annual_rainfall;
  const coverage = result.storage_recommendation.demand_coverage;
  const hasDossiers = !!result.dossiers?.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-bold">
            {t("result.title1")} <span className="gradient-text">{t("result.title2")}</span>
          </h1>
          <p className="text-muted-foreground">
            {t("result.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onNewAssessment}>
            <RotateCcw className="h-4 w-4 me-2" />
            {t("result.newAssessment")}
          </Button>
          <ReportDownloadMenu data={{ site: input, result }} />
        </div>
      </div>

      {/* Account status */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
          isSaved ? "border-success/30 bg-success/10" : "border-primary/20 bg-primary/5"
        }`}
      >
        <div className="flex items-center gap-2">
          {isSaved ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <DrawnIcon name="document" className="h-5 w-5 shrink-0 text-primary" />
          )}
          <span>{isSaved ? t("result.savedBanner") : user ? t("result.unsavedBanner") : t("result.guestBanner")}</span>
        </div>
        {!isSaved &&
          (user ? (
            <Button size="sm" variant="ocean" onClick={handleSave}>
              <Save className="h-4 w-4 me-2" />
              {t("result.saveToAccount")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={openAuthModal}>
              <LogIn className="h-4 w-4 me-2" />
              {t("auth.signIn")}
            </Button>
          ))}
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon3D name="drop" className="h-9 w-9" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("result.harvestableVolume")}</p>
                <p className="text-2xl font-bold">{units.volume(result.harvestable_volume)}</p>
                <p className="text-xs text-success">{t("result.perYear")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Icon3D name="coins" className="h-9 w-9" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("result.annualSavings")}</p>
                <p className="text-2xl font-bold">{formatCurrency(annualSavings)}</p>
                <p className="text-xs text-success">{t("result.costReduction")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Icon3D name="calculator" className="h-9 w-9" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("result.implementationCost")}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                <p className="text-xs text-muted-foreground">{t("result.oneTime")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site, rainfall and roof that produced these numbers */}
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("result.site")}</p>
            <p className="font-medium">{input.site_name}</p>
            <p className="text-xs text-muted-foreground">
              {place || `${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("climate.annual")}</p>
            <p className="font-medium">{units.rainfall(rainfall)}</p>
            {input.rainfall_period && (
              <p className="text-xs text-muted-foreground" title={input.rainfall_source}>
                {t("result.rainBasis", { period: input.rainfall_period })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("result.roof")}</p>
            <p className="font-medium">{units.area(input.roof_area)}</p>
            <p className="text-xs text-muted-foreground">
              {input.roof_polygon?.length ? t("result.roofMapped") : t("result.roofEntered")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <DrawnIcon name="droplets" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("result.demandCoverage")}</p>
            <p className="font-medium">
              {input.water_demand > 0 && coverage !== undefined ? `${Math.round(coverage * 100)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {input.water_demand > 0 ? t("result.demandPerDay", { litres: input.water_demand }) : t("details.zeroDemand")}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DrawnIcon name={recommendationIcon} className="h-6 w-6 text-primary" />
            <span>{t("result.recommendation")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Badge
              variant={getRecommendationColor(result.recommended_option)}
              className="text-sm px-4 py-2"
            >
              {recommendationLabel(result.recommended_option)}
            </Badge>
            <p className="text-muted-foreground">
              {t("result.basedOn")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Tabs defaultValue={hasDossiers ? "dossiers" : "costs"} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
          {hasDossiers && (
            <TabsTrigger value="dossiers" className="whitespace-normal">{t("result.tabDossiers")}</TabsTrigger>
          )}
          <TabsTrigger value="costs" className="whitespace-normal">{t("result.tabFinancials")}</TabsTrigger>
          <TabsTrigger value="technical" className="whitespace-normal">{t("result.tabTechnical")}</TabsTrigger>
          <TabsTrigger value="safety" className="whitespace-normal">{t("result.tabSafety")}</TabsTrigger>
        </TabsList>

        {hasDossiers && (
          <TabsContent value="dossiers" className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("dossier.intro")}</p>
            <DossierList dossiers={result.dossiers!} />
          </TabsContent>
        )}

        <TabsContent value="costs" className="space-y-6">
          {result.financial_statement ? (
            <>
              <FinancialStatement statement={result.financial_statement} />
              {result.subsidies && <SubsidyPanel subsidies={result.subsidies} />}
              <SavingsSummary monthly={result.savings_analysis.monthly_savings} payback={payback} />
            </>
          ) : (
            <>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t("result.costBreakdown")}</CardTitle>
              <CardDescription>{t("result.costBreakdownDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(result.cost_analysis).map(([key, value]) => (
                  key !== 'total_cost' && (
                    <div key={key} className="flex justify-between items-center gap-4 py-2 border-b border-border/30">
                      <span className="text-sm text-muted-foreground capitalize">
                        {COST_KEYS[key] ? t(COST_KEYS[key]) : key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium">{formatCurrency(value as number)}</span>
                    </div>
                  )
                ))}
                <div className="flex justify-between items-center gap-4 py-3 border-t-2 border-primary/20">
                  <span className="text-lg font-semibold">{t("result.totalCost")}</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(result.cost_analysis.total_cost)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">{t("result.savingsAnalysis")}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>{t("result.monthlySavings")}</span>
                    <span className="font-medium text-success">{formatCurrency(result.savings_analysis.monthly_savings)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{t("result.paybackPeriod")}</span>
                    <span className="font-medium">{t("result.years", { count: payback })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DrawnIcon name="document" className="h-5 w-5 text-primary" />
                <span>{t("result.tabBoq")}</span>
              </CardTitle>
              <CardDescription>{t("result.boqDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-start p-2 text-sm font-medium text-muted-foreground">{t("result.item")}</th>
                      <th className="text-end p-2 text-sm font-medium text-muted-foreground">{t("result.quantity")}</th>
                      <th className="text-end p-2 text-sm font-medium text-muted-foreground">{t("result.rate")}</th>
                      <th className="text-end p-2 text-sm font-medium text-muted-foreground">{t("result.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bill_of_quantities.items.map((item, index) => (
                      <tr key={index} className="border-b border-border/30">
                        <td className="p-2 text-sm">{item.item}</td>
                        <td className="p-2 text-sm text-end">{item.quantity}</td>
                        <td className="p-2 text-sm text-end">{formatCurrency(item.rate)}</td>
                        <td className="p-2 text-sm text-end font-medium">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-primary/20">
                      <td colSpan={3} className="p-2 text-end font-semibold">{t("result.total")}</td>
                      <td className="p-2 text-end font-bold text-primary">{formatCurrency(result.bill_of_quantities.total_cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        
            </>
          )}
        </TabsContent>

        <TabsContent value="technical" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Storage Requirements */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DrawnIcon name="barrel" className="h-5 w-5 text-primary" />
                  <span>{t("result.storageSystem")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.requiredVolume")}</span>
                    <span className="font-medium">{units.volume(result.storage_recommendation.required_volume)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.recommendedVolume")}</span>
                    <span className="font-medium">{units.volume(result.storage_recommendation.recommended_volume)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.storageDuration")}</span>
                    <span className="font-medium">{t("result.days", { count: result.storage_recommendation.storage_days })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recharge System */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DrawnIcon name="drop" className="h-5 w-5 text-accent" />
                  <span>{t("result.rechargeSystem")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.pitDiameter")}</span>
                    <span className="font-medium">{units.length(result.recharge_recommendation.recharge_pit.diameter)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.pitDepth")}</span>
                    <span className="font-medium">{units.length(result.recharge_recommendation.recharge_pit.depth)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("result.suitability")}</span>
                    <span className="font-medium">{result.recharge_recommendation.suitability_score}</span>
                  </div>
                </div>
                <Progress value={result.recharge_recommendation.suitability_score * 10} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DrawnIcon name="warning" className="h-5 w-5 text-warning" />
                <span>{t("result.safetyTitle")}</span>
              </CardTitle>
              <CardDescription>{t("result.safetyDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.safety_checks.map((check, index) => (
                  <div key={index} className={`p-3 rounded-lg border-s-4 ${
                    check.includes('CRITICAL')
                      ? 'bg-destructive/10 border-destructive'
                      : check.includes('WARNING')
                      ? 'bg-warning/10 border-warning'
                      : 'bg-primary/10 border-primary'
                  }`}>
                    <p className="text-sm" lang="en">{check}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SavingsSummary = ({ monthly, payback }: { monthly: number; payback: string | number }) => {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm sm:grid-cols-2">
      <div className="flex justify-between gap-4">
        <span>{t("result.monthlySavings")}</span>
        <span className="font-medium text-success">{formatCurrency(monthly)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{t("result.paybackPeriod")}</span>
        <span className="font-medium">{payback === "—" ? t("result.noPayback") : t("result.years", { count: payback })}</span>
      </div>
    </div>
  );
};
