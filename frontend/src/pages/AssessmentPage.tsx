import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { AssessmentForm, type AssessmentFormData } from "@/components/AssessmentForm";
import { AssessmentResult } from "@/components/AssessmentResult";
import { AssessmentResult as AssessmentResultType, SiteDetailsInput } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getAssessment } from "@/lib/historyService";
import { useToast } from "@/hooks/use-toast";

interface CurrentAssessment {
  result: AssessmentResultType;
  input: SiteDetailsInput;
}

const AssessmentPage = () => {
  const [current, setCurrent] = useState<CurrentAssessment | null>(null);
  const [prefill, setPrefill] = useState<Partial<AssessmentFormData> | undefined>();
  // Remount the form when its starting values change
  const [formKey, setFormKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // ?view=<id> reopens a saved assessment; ?prefill=<id> starts the form from
  // a saved satellite analysis
  const viewId = searchParams.get("view");
  const prefillId = searchParams.get("prefill");

  // Handle each link once, so a language change doesn't reset a form being edited
  const handledLink = useRef<string | null>(null);

  useEffect(() => {
    const id = viewId || prefillId;
    if (!id || !user) return;
    const linkKey = `${user.id}|${viewId}|${prefillId}`;
    if (handledLink.current === linkKey) return;
    handledLink.current = linkKey;

    const entry = getAssessment(user.id, id);
    if (!entry) {
      toast({ title: t("page.notFoundInHistory"), variant: "destructive" });
      setSearchParams({}, { replace: true });
      return;
    }
    if (viewId && entry.result) {
      setCurrent({ result: entry.result, input: entry.site as SiteDetailsInput });
    } else {
      setCurrent(null);
      setPrefill({
        site_name: entry.site.site_name,
        latitude: entry.site.latitude ?? 0,
        longitude: entry.site.longitude ?? 0,
        roof_area: Math.round(entry.satellite?.roof_area ?? entry.site.roof_area ?? 0),
        annual_rainfall: Math.round(entry.satellite?.annual_rainfall ?? entry.site.annual_rainfall ?? 0),
      });
      setFormKey((key) => key + 1);
    }
  }, [viewId, prefillId, user, t, toast, setSearchParams]);

  const handleAssessmentSuccess = (result: AssessmentResultType, input: SiteDetailsInput) => {
    setCurrent({ result, input });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNewAssessment = () => {
    setCurrent(null);
    setPrefill(undefined);
    setFormKey((key) => key + 1);
    if (viewId || prefillId) setSearchParams({}, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {current ? (
          <AssessmentResult result={current.result} input={current.input} onNewAssessment={handleNewAssessment} />
        ) : (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-3xl lg:text-4xl font-bold">
                {t("page.assessTitle1")} <span className="gradient-text">{t("page.assessTitle2")}</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("page.assessSubtitle")}
              </p>
            </div>

            <AssessmentForm key={formKey} initialValues={prefill} onSuccess={handleAssessmentSuccess} />
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentPage;
