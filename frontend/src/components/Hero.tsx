import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator, FileText, Zap, Satellite } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-rainwater.png";

export const Hero = () => {
  const features = [
    {
      icon: Calculator,
      title: "Smart assessment",
      description: "Harvestable volume, storage and recharge sizing calculated from your roof, soil and rainfall.",
    },
    {
      icon: Satellite,
      title: "Satellite analysis",
      description: "Mark your rooftop on a satellite tile and get its area measured automatically.",
    },
    {
      icon: FileText,
      title: "Detailed reports",
      description: "Download PDF and text reports with cost breakdown and bill of quantities.",
    },
    {
      icon: Zap,
      title: "Instant results",
      description: "A complete feasibility analysis in minutes, not days.",
    },
  ];

  const steps = [
    { label: "01", title: "Describe the site", text: "Location, roof area and material, soil type, rainfall and daily demand." },
    { label: "02", title: "Get the recommendation", text: "Storage, recharge or hybrid, sized to your numbers with safety checks." },
    { label: "03", title: "Plan the build", text: "Costs, payback period and a ready bill of quantities for contractors." },
  ];

  return (
    <>
      {/* Hero — left-aligned whisper headline */}
      <section className="relative overflow-hidden bg-background">
        {/* Faint paper-texture pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(circle, #e5e8ec 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to bottom, black, transparent 70%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-page px-6 pb-16 pt-20 lg:pb-20 lg:pt-28">
          <div className="max-w-prose animate-fade-up">
            <p className="eyebrow mb-6">Rooftop rainwater harvesting</p>
            <h1 className="text-[44px] sm:text-heading-lg lg:text-display">
              Turn every rooftop into a water source.
            </h1>
            <p className="mt-6 max-w-[560px] text-body text-slate">
              Barkha.ai assesses your site and tells you how much rain you can capture, what to build,
              what it costs and how fast it pays back.
            </p>

            <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button size="lg" asChild>
                <Link to="/assess" className="group">
                  Start free assessment
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/satellite">Try satellite analysis</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Product showcase card */}
        <div className="relative mx-auto max-w-page px-6 pb-24 lg:pb-32">
          <div className="showcase-card animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="relative overflow-hidden rounded-xl border border-border bg-card">
              <img
                src={heroImage}
                alt="Rainwater harvesting system on a modern rooftop"
                className="h-auto w-full"
              />
              <div className="absolute bottom-6 left-6 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-panel sm:block">
                <div className="eyebrow">Annual harvest potential</div>
                <div className="mt-1 text-heading-sm font-extralight text-foreground">15,000 L</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — Mist band */}
      <section className="bg-muted">
        <div className="mx-auto max-w-page px-6 py-24 lg:py-28">
          <div className="mx-auto max-w-prose text-center">
            <h2 className="text-[32px] sm:text-heading">Everything a site survey gives you, without the wait.</h2>
            <p className="mt-5 text-body text-slate">
              Enter your site details once and get sizing, costs and reports in one place.
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="surface p-6">
                  <Icon className="h-5 w-5 text-slate" strokeWidth={1.5} />
                  <h3 className="mt-5 text-base font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works — Paper White */}
      <section className="bg-background">
        <div className="mx-auto max-w-page px-6 py-24 lg:py-28">
          <div className="max-w-prose">
            <h2 className="text-[32px] sm:text-heading">Three steps to a buildable plan.</h2>
          </div>
          <div className="mt-14 grid gap-10 border-t border-border pt-10 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.label}>
                <span className="key-chip">{step.label}</span>
                <h3 className="mt-5 text-subheading font-normal">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 flex flex-col items-start gap-6 rounded-3xl border border-border bg-muted p-8 sm:flex-row sm:items-center sm:justify-between lg:p-10">
            <div>
              <h2 className="text-heading-sm">Ready to check your rooftop?</h2>
              <p className="mt-2 text-sm text-muted-foreground">It takes about two minutes and needs no sign-up.</p>
            </div>
            <Button size="lg" asChild>
              <Link to="/assess">Start assessment</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-page flex-col gap-2 px-6 py-8 text-xs text-graphite sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Barkha.ai — Water intelligence for every rooftop</span>
          <div className="flex gap-5">
            <Link to="/assess" className="hover:text-slate">Assessment</Link>
            <Link to="/satellite" className="hover:text-slate">Satellite analysis</Link>
          </div>
        </div>
      </footer>
    </>
  );
};
