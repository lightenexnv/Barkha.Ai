import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { SiteOption } from "@/lib/siteOptions";

interface OptionCardGroupProps<V extends string> {
  label: string;
  options: SiteOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** "lg" for the main form, "sm" for the compact fine-tune panel */
  size?: "lg" | "sm";
  className?: string;
}

/**
 * A radio group drawn as photo cards. The whole card is the hit target; arrow
 * keys move the selection like a native radio group.
 */
export function OptionCardGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  size = "lg",
  className,
}: OptionCardGroupProps<V>) {
  const { t } = useLanguage();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const large = size === "lg";

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid gap-3",
        large ? "grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => (refs.current[index] = node)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card text-start transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "-translate-y-0.5 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15),0_12px_28px_-10px_hsl(var(--primary)/0.55)]"
                : "border-border/60 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
            )}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
              <img
                src={option.image}
                alt={t(option.label)}
                loading="lazy"
                decoding="async"
                draggable={false}
                className={cn(
                  "h-full w-full object-cover transition-transform duration-500",
                  selected ? "scale-[1.03]" : "group-hover:scale-[1.03]",
                )}
              />
              <span className="absolute bottom-2 start-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
                {option.metric}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200",
                  selected
                    ? "scale-100 border-white bg-primary text-primary-foreground shadow-lg"
                    : "scale-90 border-white/80 bg-black/25 text-transparent",
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            </div>
            <div className={cn("flex flex-1 flex-col gap-1", large ? "p-3.5" : "p-2.5")}>
              <span className={cn("font-semibold leading-tight", large ? "text-base" : "text-sm", selected && "text-primary")}>
                {t(option.label)}
              </span>
              {large && <span className="text-sm leading-snug text-muted-foreground">{t(option.caption)}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
