// Modal dialog showing month-by-month rainwater harvest, rainfall, and savings report
// Includes a direct 'Download PDF Report' button.
import { useState } from "react";
import { Download, FileDown, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/api";
import { printMonthlyReport, type MonthlyReportData } from "@/lib/monthlyReportGenerator";
import { useToast } from "@/hooks/use-toast";

interface MonthlyReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MonthlyReportData;
}

export const MonthlyReportModal = ({ open, onOpenChange, data }: MonthlyReportModalProps) => {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await printMonthlyReport(data);
      toast({
        title: "Print Preview Opened",
        description: "Select 'Save as PDF' in the print dialog to export your monthly report.",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({
        title: "Report Generation Failed",
        description: "Could not open the print preview. Please check browser popups/permissions.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const impDate = new Date(data.implementedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl font-bold">Monthly Savings & Harvest Statement</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Site: <strong className="text-foreground">{data.site.site_name || "Property"}</strong> · Implemented on{" "}
            <strong className="text-foreground">{impDate}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Highlight summary cards */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
            <p className="text-[11px] font-semibold uppercase text-sky-600 dark:text-sky-400">Estimated Collected So Far</p>
            <p className="mt-1 text-lg font-bold text-sky-950 dark:text-sky-100">
              {data.totalHarvestLitres.toLocaleString("en-IN")} L
            </p>
            <p className="text-[11px] text-muted-foreground">{(data.totalHarvestLitres / 1000).toFixed(2)} m³ collected</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Total Money Saved</p>
            <p className="mt-1 text-lg font-bold text-emerald-950 dark:text-emerald-100">
              {formatCurrency(data.totalSavings)}
            </p>
            <p className="text-[11px] text-muted-foreground">Water bill reduction</p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-[11px] font-semibold uppercase text-primary">Paid Off In</p>
            <p className="mt-1 text-lg font-bold">
              {data.remainingPaybackYears !== null ? `${data.remainingPaybackYears.toFixed(1)} yrs` : "N/A"}
            </p>
            <p className="text-[11px] text-muted-foreground">Remaining payback</p>
          </div>
        </div>

        {/* Scrollable Month Table */}
        <div className="flex-1 overflow-y-auto border rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm text-muted-foreground uppercase text-[10px] font-bold border-b">
              <tr>
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-2 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Rain (mm)</th>
                <th className="py-2.5 px-3 text-right">Harvest (L)</th>
                <th className="py-2.5 px-3 text-right">Savings (₹)</th>
                <th className="py-2.5 px-3 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.records.map((rec) => (
                <tr key={rec.monthIndex} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground">{rec.monthName}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        rec.status === "Estimated"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{Math.round(rec.rainMm)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-sky-600 dark:text-sky-400">
                    {rec.harvestLitres.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(rec.savings)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">
                    {formatCurrency(rec.cumulativeSavings)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Tariff rate used: <strong className="text-foreground">{formatCurrency(data.result.savings_analysis?.water_tariff_used ?? 50)}/m³</strong>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button size="sm" variant="ocean" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF Report
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
