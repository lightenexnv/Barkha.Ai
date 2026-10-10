import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Loader2, MapPin, Mic, MicOff, Minus, Plus, RotateCcw, Share2, Volume2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReportDownload } from "@/components/ReportDownloadMenu";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { api, type AssessmentResult, type SiteDetailsInput } from "@/lib/api";
import { fetchRainfall, findPlaceInIndia, reverseGeocode } from "@/lib/climate";
import { Input } from "@/components/ui/input";
import { buildAssessmentEntry, saveAssessment } from "@/lib/historyService";
import { isLanguageCode } from "@/lib/i18n";
import {
  ASK_LANGUAGE, MATERIAL_WORDS, ROOF_SIZE_AREA, ROOF_SIZE_WORDS, SARAL_LANGUAGES, YES_NO_WORDS,
  matchKeyword, matchLanguage, parseCount, placeQueries, say, tankersPerYear, type RoofSize, type SaralLang,
} from "@/lib/saral";
import { ROOF_MATERIAL_OPTIONS } from "@/lib/siteOptions";
import { shareMessage, whatsappUrl } from "@/lib/share";
import { canListen, hasVoiceFor, listen, ListenError, speak, stopSpeaking, type ListenHandle } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { placeLine } from "@/components/assessment/model";
import { HouseSizePicture } from "./HouseSizePicture";

type Step = "language" | "location" | "confirm" | "roof" | "material" | "people" | "working" | "result" | "error";
type Material = keyof typeof MATERIAL_WORDS;
type Verdict = "good" | "ok" | "recharge" | "no";

interface Place {
  latitude: number;
  longitude: number;
  label: string;
}

const LPCD = 135;
const STEPS_WITH_DOTS: Step[] = ["location", "roof", "material", "people", "result"];

const verdictOf = (result: AssessmentResult): Verdict => {
  if (result.recommended_option === "not_feasible") return "no";
  const total = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const yearly = result.savings_analysis.annual_cost_savings;
  if (yearly <= 0) return "recharge";
  return total / yearly <= 30 ? "good" : "ok";
};

const shortPlace = (label: string) => label.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 2).join(", ");

/** Floating mic button plus a one-question-at-a-time voice assistant ("Saral" = simple). */
export const SaralAssistant = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const { preferences } = useSettings();
  const { download, busyFormat } = useReportDownload();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("language");
  const [lang, setLang] = useState<SaralLang>("hi");
  const [place, setPlace] = useState<Place | null>(null);
  const [roofSize, setRoofSize] = useState<RoofSize | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [people, setPeople] = useState(4);
  const [plan, setPlan] = useState<{ result: AssessmentResult; input: SiteDetailsInput } | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  const session = useRef(0);
  const listener = useRef<ListenHandle | null>(null);
  const speechLang = SARAL_LANGUAGES.find((l) => l.code === lang)!.speech;
  const voiceAvailable = hasVoiceFor(speechLang);

  const stopAll = useCallback(() => {
    session.current++;
    stopSpeaking();
    listener.current?.stop();
    listener.current = null;
    setListening(false);
  }, []);

  /** Speak in the chosen language (skipped when the device has no voice for it). */
  const talk = useCallback(
    async (text: string, overrideLang?: string) => {
      const target = overrideLang ?? speechLang;
      if (!hasVoiceFor(target)) return;
      await speak(text, target);
    },
    [speechLang],
  );

  /** Listen once and pass what was heard to `onHeard`. Failures just show the tap hint. */
  const hear = useCallback(
    async (onHeard: (alternatives: string[]) => void, recogniserLang?: string) => {
      if (!canListen()) return;
      const id = session.current;
      listener.current?.stop();
      setListening(true);
      setHeard("");
      const handle = listen(recogniserLang ?? speechLang);
      listener.current = handle;
      try {
        const alternatives = await handle.result;
        if (id !== session.current) return;
        setHeard(alternatives[0] ?? "");
        onHeard(alternatives);
      } catch (error) {
        if (id !== session.current) return;
        if (error instanceof ListenError && error.code === "denied") setHint("mic");
      } finally {
        if (id === session.current) setListening(false);
      }
    },
    [speechLang],
  );

  const reset = () => {
    setStep("language");
    setPlace(null);
    setRoofSize(null);
    setMaterial(null);
    setPeople(4);
    setPlan(null);
    setHeard("");
    setHint("");
  };

  const goTo = (next: Step) => {
    stopAll();
    setHint("");
    setHeard("");
    setStep(next);
  };

  /* ---------------- answers ---------------- */

  const chooseLanguage = (code: SaralLang) => {
    setLang(code);
    if (isLanguageCode(code)) setLanguage(code);
    goTo("location");
  };

  /**
   * Find a place from what was said or typed. Speech wraps the name in a
   * sentence ("mera ghar Jaipur mein hai"), so filler words are dropped and
   * the remaining words are tried one by one until the map knows one.
   */
  const findPlace = async (alternatives: string[]) => {
    setBusy(true);
    setHint("");
    try {
      const queries = placeQueries(alternatives);
      for (let i = 0; i < queries.length; i++) {
        // The free map search allows about one request a second
        if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
        const hit = await findPlaceInIndia(queries[i]).catch(() => null);
        if (hit) {
          setPlace({ latitude: hit.latitude, longitude: hit.longitude, label: hit.label });
          goTo("confirm");
          return;
        }
      }
      setHint("placeNotFound");
      void talk(say(lang, "placeNotFound"));
    } finally {
      setBusy(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) return setHint("placeNotFound");
    stopAll();
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let label = `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
        try {
          const found = await reverseGeocode(coords.latitude, coords.longitude);
          label = placeLine(found) || label;
        } catch {
          // keep the coordinates as the label
        }
        setBusy(false);
        setPlace({ latitude: coords.latitude, longitude: coords.longitude, label });
        goTo("confirm");
      },
      () => {
        setBusy(false);
        setHint("placeNotFound");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const calculate = useCallback(async () => {
    if (!place || !roofSize || !material) return;
    goTo("working");
    try {
      const [rain, where] = await Promise.all([
        fetchRainfall(place.latitude, place.longitude),
        reverseGeocode(place.latitude, place.longitude).catch(() => null),
      ]);
      const input: SiteDetailsInput = {
        site_name: where?.city ? `Home in ${where.city}` : "My home",
        latitude: Number(place.latitude.toFixed(6)),
        longitude: Number(place.longitude.toFixed(6)),
        roof_area: ROOF_SIZE_AREA[roofSize],
        roof_material: material,
        roof_condition: "good",
        soil_type: preferences.defaultSoilType,
        annual_rainfall: rain.annual,
        monthly_rainfall: rain.monthly,
        rainfall_source: rain.source,
        rainfall_period: rain.period,
        city: where?.city || undefined,
        district: where?.district || undefined,
        state: where?.state || undefined,
        water_demand: people * LPCD,
        water_tariff: preferences.waterTariff,
        first_flush_mm: preferences.firstFlushMm,
      };
      const result = await api.createAssessment(input);
      if (user) saveAssessment(buildAssessmentEntry(user.id, input, result));
      setPlan({ result, input });
      setStep("result");
    } catch (error) {
      console.error("Saral assessment failed", error);
      setStep("error");
    }
    // goTo is stable in behaviour; listing it would re-create this on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, roofSize, material, people, preferences, user]);

  /* ---------------- what each step says and listens for ---------------- */

  const resultSpeech = useCallback(() => {
    if (!plan) return "";
    const { result } = plan;
    const verdict = verdictOf(result);
    const total = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
    const yearly = result.savings_analysis.annual_cost_savings;
    const verdictLine = say(lang, verdict === "good" ? "verdictGood" : verdict === "ok" ? "verdictOk" : verdict === "recharge" ? "verdictRecharge" : "verdictNo");
    const vars = {
      tankers: tankersPerYear(result.harvestable_volume),
      money: Math.round(result.savings_analysis.monthly_savings).toLocaleString("en-IN"),
      years: yearly > 0 ? Math.round(total / yearly) : 0,
    };
    const body = say(lang, verdict === "no" ? "summaryNo" : verdict === "recharge" ? "summaryRecharge" : "summary", vars);
    return `${verdictLine} ${body}`;
  }, [plan, lang]);

  useEffect(() => {
    if (!open) return;
    const id = ++session.current;
    const live = () => id === session.current;
    const run = async () => {
      switch (step) {
        case "language":
          await talk(ASK_LANGUAGE.hi, "hi-IN");
          if (!live()) return;
          await talk(ASK_LANGUAGE.en, "en-IN");
          if (!live()) return;
          await hear((alts) => {
            const match = matchLanguage(alts);
            if (match) chooseLanguage(match);
            else setHint("notUnderstood");
          }, "hi-IN");
          return;
        case "location":
          await talk(`${say(lang, "welcome")} ${say(lang, "askLocation")}`);
          if (!live()) return;
          await hear((alts) => void findPlace(alts));
          return;
        case "confirm":
          if (!place) return;
          await talk(say(lang, "confirmPlace", { place: shortPlace(place.label) }));
          if (!live()) return;
          await hear((alts) => {
            const answer = matchKeyword(alts, YES_NO_WORDS);
            if (answer === "yes") goTo("roof");
            else if (answer === "no") goTo("location");
            else setHint("notUnderstood");
          });
          return;
        case "roof":
          await talk(say(lang, "askRoof"));
          if (!live()) return;
          await hear((alts) => {
            const size = matchKeyword(alts, ROOF_SIZE_WORDS);
            if (size) {
              setRoofSize(size);
              goTo("material");
            } else setHint("notUnderstood");
          });
          return;
        case "material":
          await talk(say(lang, "askMaterial"));
          if (!live()) return;
          await hear((alts) => {
            const found = matchKeyword(alts, MATERIAL_WORDS);
            if (found) {
              setMaterial(found);
              goTo("people");
            } else setHint("notUnderstood");
          });
          return;
        case "people":
          await talk(say(lang, "askPeople"));
          if (!live()) return;
          await hear((alts) => {
            const count = parseCount(alts);
            if (count && count > 0) setPeople(Math.min(count, 5000));
            else setHint("notUnderstood");
          });
          return;
        case "working":
          await talk(say(lang, "working"));
          return;
        case "result":
          await talk(resultSpeech());
          return;
        case "error":
          await talk(say(lang, "failed"));
          return;
      }
    };
    void run();
    return () => {
      // A new step (or closing) cancels whatever this step was saying or hearing
      session.current += 1;
      stopSpeaking();
      listener.current?.stop();
    };
    // Runs once per step; handlers read the latest state through closures
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, place]);

  // Moving on from "people" happens on Next; speak the new count back for reassurance
  const confirmPeople = () => void calculate();

  const close = (value: boolean) => {
    if (!value) stopAll();
    setOpen(value);
  };

  const tapMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setHint("");
    const handlers: Partial<Record<Step, (alts: string[]) => void>> = {
      language: (alts) => {
        const match = matchLanguage(alts);
        if (match) chooseLanguage(match);
        else setHint("notUnderstood");
      },
      location: (alts) => void findPlace(alts),
      confirm: (alts) => {
        const answer = matchKeyword(alts, YES_NO_WORDS);
        if (answer === "yes") goTo("roof");
        else if (answer === "no") goTo("location");
        else setHint("notUnderstood");
      },
      roof: (alts) => {
        const size = matchKeyword(alts, ROOF_SIZE_WORDS);
        if (size) {
          setRoofSize(size);
          goTo("material");
        } else setHint("notUnderstood");
      },
      material: (alts) => {
        const found = matchKeyword(alts, MATERIAL_WORDS);
        if (found) {
          setMaterial(found);
          goTo("people");
        } else setHint("notUnderstood");
      },
      people: (alts) => {
        const count = parseCount(alts);
        if (count && count > 0) setPeople(Math.min(count, 5000));
        else setHint("notUnderstood");
      },
    };
    const handler = handlers[step];
    if (handler) void hear(handler, step === "language" ? "hi-IN" : undefined);
  };

  /* ---------------- UI ---------------- */

  const big = "min-h-16 rounded-2xl text-lg font-semibold";
  const stepIndex = STEPS_WITH_DOTS.indexOf(step === "confirm" ? "location" : step === "working" ? "people" : step);
  const question =
    step === "language" ? `${ASK_LANGUAGE.hi} / ${ASK_LANGUAGE.en}`
      : step === "location" ? say(lang, "askLocation")
        : step === "confirm" && place ? say(lang, "confirmPlace", { place: shortPlace(place.label) })
          : step === "roof" ? say(lang, "askRoof")
            : step === "material" ? say(lang, "askMaterial")
              : step === "people" ? say(lang, "askPeople")
                : step === "working" ? say(lang, "working")
                  : step === "error" ? say(lang, "failed")
                    : "";
  const micStep = ["language", "location", "confirm", "roof", "material", "people"].includes(step);

  return (
    <>
      {/* Floating mic button */}
      <motion.button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.6 }}
        aria-label="Saral voice helper: speak to get your rainwater plan"
        className="fixed bottom-5 end-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_32px_-8px_rgba(2,119,184,0.8)] sm:bottom-7 sm:end-7"
      >
        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-sky-400/40" />
        <Mic className="relative h-7 w-7" />
        <span className="pointer-events-none absolute -top-9 end-0 whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-lg">
          बोलकर पूछें · Ask by voice
        </span>
      </motion.button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="flex max-h-[100svh] w-full max-w-2xl flex-col gap-0 overflow-y-auto p-0 sm:max-h-[92vh] sm:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
            <div>
              <DialogTitle className="text-lg font-bold">Barkha Saral</DialogTitle>
              <DialogDescription className="text-xs">बोलकर या छूकर जवाब दें · Speak or tap to answer</DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              {stepIndex >= 0 && (
                <div className="flex gap-1.5" aria-hidden="true">
                  {STEPS_WITH_DOTS.map((s, i) => (
                    <motion.span
                      key={s}
                      animate={{ width: i === stepIndex ? 22 : 8, backgroundColor: i <= stepIndex ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
                      className="h-2 rounded-full"
                    />
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => close(false)}
                aria-label="Exit voice assistant"
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-5 p-5 sm:p-7"
            >
              {question && <p className="text-2xl font-bold leading-snug sm:text-3xl">{question}</p>}

              {step !== "language" && !voiceAvailable && micStep && (
                <p className="rounded-xl bg-warning/10 p-3 text-sm">{say(lang, "noVoice")}</p>
              )}

              {/* Language */}
              {step === "language" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SARAL_LANGUAGES.map((option) => (
                    <motion.button
                      key={option.code}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => chooseLanguage(option.code)}
                      className="flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-3 hover:border-primary"
                      lang={option.code}
                    >
                      <span className="text-xl font-bold">{option.native}</span>
                      {option.code !== "en" && <span className="text-xs text-muted-foreground">{option.english}</span>}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Location */}
              {step === "location" && (
                <div className="space-y-3">
                  <Button className={cn(big, "w-full")} variant="ocean" onClick={useGps} disabled={busy}>
                    {busy ? <Loader2 className="me-2 h-6 w-6 animate-spin" /> : <MapPin className="me-2 h-6 w-6" />}
                    {busy ? say(lang, "locating") : say(lang, "gps")}
                  </Button>
                  <p className="text-center text-base text-muted-foreground">{say(lang, "orSay")}</p>
                  {/* Typing is the fallback when the spoken name is not recognised */}
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (typed.trim()) void findPlace([typed]);
                    }}
                  >
                    <Input
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                      placeholder={say(lang, "typePlace")}
                      aria-label={say(lang, "typePlace")}
                      className="h-14 rounded-2xl text-lg"
                    />
                    <Button type="submit" variant="outline" className="h-14 rounded-2xl px-5 text-lg" disabled={busy || !typed.trim()}>
                      {say(lang, "find")}
                    </Button>
                  </form>
                </div>
              )}

              {/* Confirm place */}
              {step === "confirm" && place && (
                <div className="grid grid-cols-2 gap-3">
                  <Button className={big} variant="ocean" onClick={() => goTo("roof")}>
                    <Check className="me-2 h-6 w-6" /> {say(lang, "yes")}
                  </Button>
                  <Button className={big} variant="outline" onClick={() => goTo("location")}>
                    <X className="me-2 h-6 w-6" /> {say(lang, "no")}
                  </Button>
                </div>
              )}

              {/* Roof size */}
              {step === "roof" && (
                <div className="grid grid-cols-2 gap-3">
                  {(["small", "medium", "large", "building"] as RoofSize[]).map((size) => (
                    <motion.button
                      key={size}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setRoofSize(size);
                        goTo("material");
                      }}
                      className={cn(
                        "overflow-hidden rounded-2xl border-2 bg-card text-start hover:border-primary",
                        roofSize === size ? "border-primary" : "border-border",
                      )}
                    >
                      <div className="aspect-[16/11]"><HouseSizePicture size={size} /></div>
                      <div className="p-3">
                        <p className="text-lg font-bold">{say(lang, size)}</p>
                        <p className="text-sm text-muted-foreground">{say(lang, `${size}Hint` as "smallHint")}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Roof material */}
              {step === "material" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ROOF_MATERIAL_OPTIONS.map((option) => (
                    <motion.button
                      key={option.value}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setMaterial(option.value);
                        goTo("people");
                      }}
                      className={cn(
                        "overflow-hidden rounded-2xl border-2 bg-card text-start hover:border-primary",
                        material === option.value ? "border-primary" : "border-border",
                      )}
                    >
                      <img src={option.image} alt="" className="aspect-[4/3] w-full object-cover" />
                      <p className="p-3 text-base font-bold">{say(lang, option.value)}</p>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* People */}
              {step === "people" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-center gap-5">
                    <Button aria-label="−" variant="outline" className="h-20 w-20 rounded-full" onClick={() => setPeople((n) => Math.max(1, n - 1))}>
                      <Minus className="h-8 w-8" />
                    </Button>
                    <motion.div key={people} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="min-w-28 text-center">
                      <p className="text-6xl font-extrabold tabular-nums text-primary">{people}</p>
                      <p className="text-lg text-muted-foreground">{say(lang, "people")}</p>
                    </motion.div>
                    <Button aria-label="+" variant="outline" className="h-20 w-20 rounded-full" onClick={() => setPeople((n) => Math.min(5000, n + 1))}>
                      <Plus className="h-8 w-8" />
                    </Button>
                  </div>
                  <Button className={cn(big, "w-full")} variant="ocean" onClick={confirmPeople}>
                    {say(lang, "next")}
                  </Button>
                </div>
              )}

              {/* Working */}
              {step === "working" && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-14 w-14 animate-spin text-primary" />
                </div>
              )}

              {/* Result */}
              {step === "result" && plan && (
                <SaralResult
                  lang={lang}
                  plan={plan}
                  busyPdf={busyFormat === "pdf"}
                  onListen={() => {
                    stopAll();
                    void talk(resultSpeech());
                  }}
                  onFullPlan={() => {
                    stopAll();
                    setOpen(false);
                    navigate("/assess", { state: { saralPlan: plan } });
                  }}
                  onShare={() => window.open(whatsappUrl(shareMessage(plan.input, plan.result, `*${resultSpeech()}*\n`)), "_blank", "noopener")}
                  onPdf={() => download({ site: plan.input, result: plan.result }, "pdf")}
                  onRestart={() => {
                    reset();
                    goTo("language");
                  }}
                />
              )}

              {step === "error" && (
                <Button className={cn(big, "w-full")} variant="ocean" onClick={() => void calculate()}>
                  <RotateCcw className="me-2 h-5 w-5" /> {say(lang, "startOver")}
                </Button>
              )}

              {/* Mic + feedback */}
              {micStep && canListen() && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <motion.button
                    type="button"
                    onClick={tapMic}
                    whileTap={{ scale: 0.9 }}
                    aria-label={say(lang, "tapMic")}
                    className={cn(
                      "relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg",
                      listening ? "bg-destructive" : "bg-blue-600",
                    )}
                  >
                    {listening && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
                    {listening ? <MicOff className="relative h-8 w-8" /> : <Mic className="relative h-8 w-8" />}
                  </motion.button>
                  <p className="text-base font-medium text-muted-foreground">{listening ? say(lang, "listening") : say(lang, "tapMic")}</p>
                  {heard && <p className="rounded-full bg-muted px-4 py-1 text-base">“{heard}”</p>}
                  {hint && hint !== "mic" && (
                    <p className="text-center text-base text-warning">{say(lang, hint as "notUnderstood")}</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};

const SaralResult = ({
  lang,
  plan,
  busyPdf,
  onListen,
  onFullPlan,
  onShare,
  onPdf,
  onRestart,
}: {
  lang: SaralLang;
  plan: { result: AssessmentResult; input: SiteDetailsInput };
  busyPdf: boolean;
  onListen: () => void;
  onFullPlan: () => void;
  onShare: () => void;
  onPdf: () => void;
  onRestart: () => void;
}) => {
  const { result } = plan;
  const verdict = verdictOf(result);
  const total = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const yearly = result.savings_analysis.annual_cost_savings;
  const tone = verdict === "good" ? "bg-emerald-600" : verdict === "no" ? "bg-slate-600" : "bg-blue-600";
  const title = say(lang, verdict === "good" ? "verdictGood" : verdict === "ok" ? "verdictOk" : verdict === "recharge" ? "verdictRecharge" : "verdictNo");

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className={cn("rounded-3xl p-6 text-center text-white shadow-xl", tone)}
      >
        <p className="text-3xl font-extrabold sm:text-4xl">{title}</p>
      </motion.div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-sky-500/10 p-3">
          <p className="text-3xl font-extrabold text-sky-700 dark:text-sky-300">{tankersPerYear(result.harvestable_volume)}</p>
          <p className="text-xs leading-tight text-muted-foreground">{say(lang, "statTankers")}</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 p-3">
          <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">₹{Math.round(result.savings_analysis.monthly_savings).toLocaleString("en-IN")}</p>
          <p className="text-xs leading-tight text-muted-foreground">{say(lang, "statMonthly")}</p>
        </div>
        <div className="rounded-2xl bg-teal-500/10 p-3">
          <p className="text-3xl font-extrabold text-teal-700 dark:text-teal-300">{yearly > 0 ? Math.round(total / yearly) : "—"}</p>
          <p className="text-xs leading-tight text-muted-foreground">{yearly > 0 ? `${say(lang, "years")} ${say(lang, "statPayback")}` : say(lang, "statPayback")}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button className="min-h-14 rounded-2xl text-base" variant="outline" onClick={onListen}>
          <Volume2 className="me-2 h-5 w-5" /> {say(lang, "listenAgain")}
        </Button>
        <Button className="min-h-14 rounded-2xl text-base" variant="ocean" onClick={onFullPlan}>
          {say(lang, "fullPlan")}
        </Button>
        <Button variant="outline" className="min-h-14 rounded-2xl border-[#25D366] bg-[#25D366] text-base text-white hover:bg-[#1ebe5a] hover:text-white" onClick={onShare}>
          <Share2 className="me-2 h-5 w-5" /> {say(lang, "whatsapp")}
        </Button>
        <Button className="min-h-14 rounded-2xl text-base" variant="outline" onClick={onPdf} disabled={busyPdf}>
          {busyPdf ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Download className="me-2 h-5 w-5" />} {say(lang, "pdf")}
        </Button>
      </div>
      <button type="button" onClick={onRestart} className="mx-auto block text-sm font-medium text-primary hover:underline">
        {say(lang, "startOver")}
      </button>
    </div>
  );
};
