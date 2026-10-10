import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AssessmentResult } from "@/components/AssessmentResult";
import { AssessmentWizard, type WizardSeed } from "@/components/assessment/AssessmentWizard";
import { api, AssessmentResult as AssessmentResultType, SiteDetailsInput } from "@/lib/api";
import { readPlanLink } from "@/lib/share";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getAssessment, getLastCompletedAssessment } from "@/lib/historyService";
import { downloadReport } from "@/lib/reports";
import { useToast } from "@/hooks/use-toast";

interface SavedView {
  result: AssessmentResultType;
  input: SiteDetailsInput;
}

const AssessmentPage = () => {
  const [saved, setSaved] = useState<SavedView | null>(null);
  const [seed, setSeed] = useState<WizardSeed | undefined>();
  // Remount the wizard when it should start from new values
  const [wizardKey, setWizardKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // ?view=<id> reopens a saved assessment; ?prefill=<id> starts the workflow
  // from a saved analysis; ?plan=<data> rebuilds a shared plan
  const viewId = searchParams.get("view");
  const prefillId = searchParams.get("prefill");
  const sharedPlan = searchParams.get("p") || searchParams.get("plan");
  const location = useLocation();
  const [loadingShared, setLoadingShared] = useState(false);

  // A plan handed over by the Saral voice assistant
  useEffect(() => {
    const handed = (location.state as { saralPlan?: SavedView } | null)?.saralPlan;
    if (handed) {
      setSaved(handed);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  // A plan opened from a shared WhatsApp link: recompute it from its inputs
  useEffect(() => {
    if (!sharedPlan) return;
    const input = readPlanLink(sharedPlan);
    if (!input) {
      toast({ title: t("share.badLink"), variant: "destructive" });
      setSearchParams({}, { replace: true });
      return;
    }
    let cancelled = false;
    setLoadingShared(true);
    api
      .createAssessment(input)
      .then((result) => {
        if (!cancelled) {
          setSaved({ result, input });
          if (input.shared_by) {
            toast({
              title: `Shared by ${input.shared_by}`,
              description: `Viewing rainwater harvesting assessment for ${input.site_name}.`,
            });
          }
        }
      })
      .catch(() => !cancelled && toast({ title: t("toast.assessmentFailed"), description: t("toast.assessmentFailedDesc"), variant: "destructive" }))
      .finally(() => !cancelled && setLoadingShared(false));
    return () => {
      cancelled = true;
    };
  }, [sharedPlan, t, toast, setSearchParams]);

  // Handle each link once, so a language change doesn't reset work in progress
  const handledLink = useRef<string | null>(null);

  useEffect(() => {
    const id = viewId || prefillId;
    if (!id) return;
    const linkKey = `${user?.id ?? "guest"}|${viewId}|${prefillId}`;
    if (handledLink.current === linkKey) return;
    handledLink.current = linkKey;

    const entry = (user ? getAssessment(user.id, id) : null) ?? (getLastCompletedAssessment()?.id === id ? getLastCompletedAssessment() : null);
    if (!entry) {
      toast({ title: t("page.notFoundInHistory"), variant: "destructive" });
      setSearchParams({}, { replace: true });
      return;
    }
    if (viewId && entry.result) {
      setSaved({ result: entry.result, input: entry.site as SiteDetailsInput });
      if (searchParams.get("download") === "pdf") {
        downloadReport({ site: entry.site as SiteDetailsInput, result: entry.result }, "pdf");
      }
    } else {
      setSaved(null);
      const { latitude, longitude } = entry.site;
      setSeed({
        location: latitude && longitude ? [latitude, longitude] : undefined,
        roofArea: entry.satellite?.roof_area ?? entry.site.roof_area,
        siteName: entry.site.site_name,
      });
      setWizardKey((key) => key + 1);
    }
  }, [viewId, prefillId, user, t, toast, searchParams, setSearchParams]);

  const startNew = () => {
    setSaved(null);
    setSeed(undefined);
    setWizardKey((key) => key + 1);
    if (viewId || prefillId || sharedPlan) setSearchParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loadingShared && !saved ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : saved ? (
          <AssessmentResult result={saved.result} input={saved.input} onNewAssessment={startNew} />
        ) : (
          <div className="space-y-8">
            <div className="space-y-3 text-center">
              <h1 className="text-3xl font-bold lg:text-4xl">
                {t("page.assessTitle1")} <span className="gradient-text">{t("page.assessTitle2")}</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{t("page.assessSubtitle")}</p>
            </div>

            <AssessmentWizard key={wizardKey} seed={seed} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AssessmentPage;
