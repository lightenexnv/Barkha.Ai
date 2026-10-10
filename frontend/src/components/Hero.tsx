import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Satellite } from "lucide-react";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { DrawnIcon } from "@/components/DrawnIcon";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-rainwater.png";
import { computeHeroLayout, paintBackdrop } from "@/components/hero/heroLayout";
import "@/components/hero/WaterRefraction.css";

const WaterHeroScene = lazy(() => import("@/components/hero/WaterHeroScene"));

const features: { icon: Icon3DName; title: string; description: string }[] = [
  {
    icon: "calculator",
    title: "Smart Assessment",
    description: "AI-powered calculations for optimal rainwater harvesting",
  },
  {
    icon: "satellite",
    title: "Satellite Analysis",
    description: "Automated rooftop dimension calculation using satellite imagery",
  },
  {
    icon: "document",
    title: "Detailed Reports",
    description: "Professional PDF reports with cost analysis & BOQ",
  },
  {
    icon: "lightning",
    title: "Instant Results",
    description: "Get feasibility analysis in minutes, not days",
  },
];

const stats = [
  { value: "Dimension", label: "Planning" },
  { value: "Easy", label: "Accessibility" },
  { value: "Neural Network", label: "Based Calculation" },
];

function supportsWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [fontsReady, setFontsReady] = useState(false);
  const [backdropVersion, setBackdropVersion] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [inView, setInView] = useState(true);
  const webgl = useMemo(supportsWebGL2, []);
  const reducedMotion = usePrefersReducedMotion();

  // The painted title needs Inter before it is measured and drawn.
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setFontsReady(true);
    const timeout = window.setTimeout(done, 1500);
    document.fonts?.load("800 100px Inter").then(done, done);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const measure = () => {
      const rect = section.getBoundingClientRect();
      setBox((prev) =>
        prev.width === rect.width && prev.height === rect.height ? prev : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => (box.width ? computeHeroLayout(box.width, viewportHeight) : null),
    // fontsReady: re-measure the title once Inter has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box.width, viewportHeight, fontsReady],
  );

  useLayoutEffect(() => {
    const canvas = backdropRef.current;
    if (!canvas || !layout || !box.height) return;
    paintBackdrop(canvas, layout, box.width, box.height, Math.min(window.devicePixelRatio || 1, 2));
    setBackdropVersion((v) => v + 1);
  }, [layout, box.width, box.height]);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  const sectionStyle = {
    minHeight: layout?.isDesktop ? layout.minHeight : "100svh",
    "--waterline": `${layout?.waterline ?? 0}px`,
  } as CSSProperties;

  const columnStyle: CSSProperties | undefined = layout
    ? layout.isDesktop
      ? { marginLeft: layout.gutter, width: Math.max(layout.columnWidth, 460) }
      : { marginInline: "auto", width: layout.columnWidth, maxWidth: 560 }
    : undefined;

  return (
    <>
      <section
        ref={sectionRef}
        className="relative isolate overflow-hidden bg-[#06263f]"
        style={sectionStyle}
        aria-labelledby="hero-title"
      >
        {/* Sky, water and the title, painted for the water shader. Also the
            static fallback when WebGL is unavailable. */}
        <canvas ref={backdropRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {layout && !webgl && (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-water"
            style={{ left: layout.island.x, top: layout.island.y - layout.island.width * 0.2, width: layout.island.width * 0.9 }}
          />
        )}

        {layout && webgl && box.height > 0 && backdropRef.current && (
          <div
            className={`absolute inset-0 transition-opacity duration-700 ${sceneReady ? "opacity-100" : "opacity-0"}`}
          >
            <Suspense fallback={null}>
              <WaterHeroScene
                layout={layout}
                backdrop={backdropRef.current}
                backdropVersion={backdropVersion}
                animate={!reducedMotion}
                active={inView}
                eventSource={sectionRef}
                onReady={handleSceneReady}
              />
            </Suspense>
          </div>
        )}

        {/* The shader draws the moving surface; this line stands in without WebGL. */}
        {layout && !webgl && (
          <div className="water-refraction__surface" aria-hidden="true">
            <span className="water-refraction__glint" />
          </div>
        )}

        {/* The visible title is painted into the water; this is its text. */}
        <h1 id="hero-title" className="sr-only">
          Intelligent Rainwater Harvesting Assessment
        </h1>

        {layout && (
          <>
            <div
              className={`absolute z-10 ${layout.isDesktop ? "" : "left-1/2 -translate-x-1/2"}`}
              style={{ top: layout.badgeTop, left: layout.isDesktop ? layout.gutter : undefined }}
            >
              <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/80 bg-white/70 px-4 py-2 text-sm font-medium text-primary shadow-soft backdrop-blur-md">
                <DrawnIcon name="droplets" className="h-4 w-4 animate-float" />
                <span>Professional Water Assessment Platform</span>
              </div>
            </div>

            <div
              className={`relative z-10 pb-20 ${layout.isDesktop ? "" : "text-center"}`}
              style={{ paddingTop: layout.contentTop }}
            >
              <div style={columnStyle} className="space-y-8">
                <p className={`text-lg leading-relaxed text-white/80 ${layout.isDesktop ? "max-w-md" : "mx-auto max-w-md"}`}>
                  Transform rooftops into sustainable water sources. Get professional feasibility reports, cost
                  analysis, and implementation guidance in minutes.
                </p>

                <div className={`flex flex-col gap-3 sm:flex-row ${layout.isDesktop ? "" : "sm:justify-center"}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-white bg-white text-[#0b2540] shadow-lg hover:scale-[1.03] hover:border-white hover:bg-white hover:text-primary"
                  >
                    <Link to="/assess" className="group">
                      Start Free Assessment
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="glass"
                    asChild
                    className="text-white hover:bg-white/20"
                  >
                    <Link to="/satellite">
                      <Satellite className="h-5 w-5" />
                      Try Satellite Analysis
                    </Link>
                  </Button>
                </div>

                <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col-reverse gap-1">
                      <dt className="text-xs text-white/60 sm:text-sm">{stat.label}</dt>
                      <dd className="text-base font-semibold text-white sm:text-lg">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="relative bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">From roof to recharge</p>
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              Everything you need to plan a rainwater system
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              return (
                <div
                  key={feature.title}
                  className="group glass-card rounded-xl p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/5">
                    <Icon3D
                      name={feature.icon}
                      className="h-11 w-11 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
                    />
                  </div>
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};
