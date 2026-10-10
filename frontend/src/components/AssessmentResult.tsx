import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, RotateCcw } from "lucide-react";
import { api, AssessmentResult as AssessmentResultType, formatCurrency, formatVolume, RECOMMENDATION_LABELS } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

interface AssessmentResultProps {
  result: AssessmentResultType;
  onNewAssessment: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
  </div>
);

export const AssessmentResult = ({ result, onNewAssessment }: AssessmentResultProps) => {
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'hybrid':
      case 'storage_priority_hybrid':
        return 'success';
      case 'storage_only':
      case 'recharge_only':
        return 'secondary';
      case 'not_feasible':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleDownloadReport = async () => {
    try {
      const blob = await api.downloadPdfReport(result.assessment_id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RTRWH_Assessment_${result.assessment_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report downloaded",
        description: "Your PDF report has been saved.",
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download failed",
        description: "Failed to download report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const recommendationLabel =
    RECOMMENDATION_LABELS[result.recommended_option as keyof typeof RECOMMENDATION_LABELS] || result.recommended_option;

  const stats = [
    { label: "Harvestable volume", value: formatVolume(result.harvestable_volume), note: "per year" },
    { label: "Annual savings", value: formatCurrency(result.savings_analysis.annual_cost_savings), note: "on water bills" },
    { label: "Implementation cost", value: formatCurrency(result.cost_analysis.total_cost), note: "one-time investment" },
  ];

  return (
    <div className="space-y-10 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-prose">
          <p className="eyebrow mb-5">Assessment results</p>
          <h1 className="text-[40px] sm:text-heading-lg">Your rooftop, in numbers.</h1>
          <p className="mt-4 text-body text-slate">
            Feasibility analysis for rainwater harvesting based on your site details.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onNewAssessment}>
            <RotateCcw strokeWidth={1.5} />
            New assessment
          </Button>
          <Button onClick={handleDownloadReport}>
            <Download strokeWidth={1.5} />
            Download report
          </Button>
        </div>
      </div>

      {/* Key figures */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="surface p-6">
            <p className="eyebrow">{stat.label}</p>
            <p className="mt-4 text-heading font-extralight text-foreground tabular-nums">{stat.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{stat.note}</p>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted px-6 py-5 sm:flex-row sm:items-center sm:gap-4">
        <span className="eyebrow">Recommendation</span>
        <Badge variant={getRecommendationColor(result.recommended_option)} className="w-fit rounded-full px-3 py-1 text-[13px]">
          {recommendationLabel}
        </Badge>
        <p className="text-sm text-muted-foreground">Based on your site conditions and requirements.</p>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="technical" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-max gap-1 rounded-lg bg-secondary p-1">
            <TabsTrigger value="technical" className="rounded-md px-3 py-1.5 font-normal data-[state=active]:font-medium data-[state=active]:shadow-subtle">Technical details</TabsTrigger>
            <TabsTrigger value="costs" className="rounded-md px-3 py-1.5 font-normal data-[state=active]:font-medium data-[state=active]:shadow-subtle">Cost analysis</TabsTrigger>
            <TabsTrigger value="boq" className="rounded-md px-3 py-1.5 font-normal data-[state=active]:font-medium data-[state=active]:shadow-subtle">Bill of quantities</TabsTrigger>
            <TabsTrigger value="safety" className="rounded-md px-3 py-1.5 font-normal data-[state=active]:font-medium data-[state=active]:shadow-subtle">Safety checks</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="technical">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Storage system</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="Required volume" value={formatVolume(result.storage_recommendation.required_volume)} />
                <Row label="Recommended volume" value={formatVolume(result.storage_recommendation.recommended_volume)} />
                <Row label="Storage duration" value={`${result.storage_recommendation.storage_days} days`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Recharge system</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="Pit diameter" value={`${result.recharge_recommendation.recharge_pit.diameter} m`} />
                <Row label="Pit depth" value={`${result.recharge_recommendation.recharge_pit.depth} m`} />
                <Row label="Suitability score" value={`${result.recharge_recommendation.suitability_score} / 10`} />
                <Progress value={result.recharge_recommendation.suitability_score * 10} className="mt-4" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Cost breakdown</CardTitle>
              <CardDescription>Implementation costs including labour and tax.</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.entries(result.cost_analysis).map(([key, value]) => (
                key !== 'total_cost' && (
                  <Row key={key} label={key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())} value={formatCurrency(value as number)} />
                )
              ))}
              <div className="mt-2 flex items-baseline justify-between border-t border-foreground/80 pt-4">
                <span className="text-sm font-medium text-foreground">Total cost</span>
                <span className="text-heading-sm font-extralight text-foreground tabular-nums">{formatCurrency(result.cost_analysis.total_cost)}</span>
              </div>

              <div className="mt-6 rounded-xl bg-muted px-5 py-2">
                <Row label="Monthly savings" value={formatCurrency(result.savings_analysis.monthly_savings)} />
                <Row
                  label="Payback period"
                  value={`${result.payback_period || Math.ceil(result.cost_analysis.total_cost / result.savings_analysis.annual_cost_savings)} years`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boq">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Bill of quantities</CardTitle>
              <CardDescription>Material and labour requirements.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="eyebrow py-3 pr-4 text-left font-medium">Item</th>
                      <th className="eyebrow px-4 py-3 text-right font-medium">Quantity</th>
                      <th className="eyebrow px-4 py-3 text-right font-medium">Rate</th>
                      <th className="eyebrow py-3 pl-4 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.bill_of_quantities.items.map((item, index) => (
                      <tr key={index} className="border-b border-border">
                        <td className="py-3 pr-4 text-sm text-foreground">{item.item}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate">{formatCurrency(item.rate)}</td>
                        <td className="py-3 pl-4 text-right text-sm font-medium text-foreground">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="pt-4 text-right text-sm font-medium text-foreground">Total</td>
                      <td className="pl-4 pt-4 text-right text-subheading font-extralight text-foreground">{formatCurrency(result.bill_of_quantities.total_cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Safety & compliance</CardTitle>
              <CardDescription>Important considerations and requirements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.safety_checks.map((check, index) => {
                const tone = check.includes('CRITICAL')
                  ? 'border-l-destructive'
                  : check.includes('WARNING') || check.includes('REQUIRED')
                  ? 'border-l-warning'
                  : 'border-l-silver';
                return (
                  <div key={index} className={`rounded-lg border border-l-2 border-border bg-card px-4 py-3 ${tone}`}>
                    <p className="text-sm text-slate">{check}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
