import { useCallback, useState } from "react";
import { ChevronDown, Download, FileArchive, FileText, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import type { ReportFormat } from "@/lib/api";
import type { ReportData } from "@/lib/clientReportGenerator";
import { downloadReport } from "@/lib/reports";

/** Runs the report pipeline and reports the outcome in a toast. */
export const useReportDownload = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busyFormat, setBusyFormat] = useState<ReportFormat | null>(null);

  const download = useCallback(
    async (data: ReportData, format: ReportFormat) => {
      setBusyFormat(format);
      try {
        const outcome = await downloadReport(data, format);
        const description =
          outcome === "server-direct"
            ? t("report.fromSavedData")
            : outcome === "client-text"
              ? t("report.offlineText")
              : outcome === "client-print"
                ? t("report.offline")
                : undefined;
        toast({ title: t("report.success"), description });
      } catch (error) {
        console.error("Report download failed:", error);
        toast({ title: t("report.failed"), variant: "destructive" });
      } finally {
        setBusyFormat(null);
      }
    },
    [t, toast],
  );

  return { download, busyFormat };
};

interface ReportDownloadMenuProps {
  data: ReportData;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/** Split button: the main part downloads the PDF, the arrow offers TXT and ZIP. */
export const ReportDownloadMenu = ({ data, variant = "ocean", size = "default", className }: ReportDownloadMenuProps) => {
  const { t } = useLanguage();
  const { download, busyFormat } = useReportDownload();
  const busy = busyFormat !== null;

  return (
    <div className={`inline-flex ${className ?? ""}`}>
      <Button
        variant={variant}
        size={size}
        className="rounded-e-none"
        disabled={busy}
        onClick={() => download(data, "pdf")}
      >
        {busy ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
        {busy ? t("result.downloading") : t("result.downloadReport")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className="rounded-s-none border-s border-white/25 px-2"
            disabled={busy}
            aria-label={t("result.downloadReport")}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => download(data, "pdf")}>
            <Download className="h-4 w-4 me-2" />
            {t("result.downloadPdf")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(data, "txt")}>
            <FileText className="h-4 w-4 me-2" />
            {t("result.downloadTxt")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(data, "zip")}>
            <FileArchive className="h-4 w-4 me-2" />
            {t("result.downloadZip")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
