// Report download pipeline with fallbacks, so the user always gets a report:
//   1. the server's stored copy        GET  /api/generate-report/{id} (etc.)
//   2. the server, from local data     POST /api/generate-report-direct
//   3. the browser                     text file or print-to-PDF view
import { api, ApiError, defaultReportName, type ReportFormat } from "@/lib/api";
import { buildTextReport, printReport, type ReportData } from "@/lib/clientReportGenerator";
import { saveBlob } from "@/lib/storage";

export type ReportOutcome =
  | "server" // stored copy found on the server
  | "server-direct" // server rebuilt it from the data we sent
  | "client-text" // server unreachable; text built in the browser
  | "client-print"; // server unreachable; print view opened

const isUnreachable = (error: unknown) => error instanceof ApiError && error.status === 0;

export const downloadReport = async (data: ReportData, format: ReportFormat): Promise<ReportOutcome> => {
  const assessmentId = data.result.assessment_id;
  let serverReachable = true;

  if (assessmentId) {
    try {
      const file = await api.downloadReport(assessmentId, format);
      saveBlob(file.blob, file.filename);
      return "server";
    } catch (error) {
      console.warn("Stored report unavailable, trying direct generation", error);
      serverReachable = !isUnreachable(error);
    }
  }

  if (serverReachable) {
    try {
      const file = await api.downloadReportDirect(data.site, data.result, format);
      saveBlob(file.blob, file.filename);
      return "server-direct";
    } catch (error) {
      console.warn("Direct report generation failed, generating in the browser", error);
    }
  }

  const baseName = defaultReportName(assessmentId || "offline", "txt");
  if (format === "txt") {
    saveBlob(new Blob([buildTextReport(data)], { type: "text/plain;charset=utf-8" }), baseName);
    return "client-text";
  }
  if (format === "zip") {
    // No zip library in the bundle: give the text summary and the print view
    saveBlob(new Blob([buildTextReport(data)], { type: "text/plain;charset=utf-8" }), baseName);
  }
  await printReport(data);
  return "client-print";
};
