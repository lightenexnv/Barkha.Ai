import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { SiteOption } from "@/lib/siteOptions";

interface OptionCardGroupProps<V extends string> {
  label: string;
  options: SiteOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** "lg" shows a one-line caption; "sm" is the compact fine-tune version */
  size?: "lg" | "sm";
  className?: string;
}

/**
 * A radio group drawn as photo cards, all in one row: one column per option
 * from tablet width up, and a swipeable row on phones. Arrow keys move the
 * selection like a native radio group.
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
      // Large cards share one size across groups (a fifth of the row), so a
      // three-option group does not get giant cards; compact cards fill the row
      style={{ "--cols": large ? Math.max(options.length, 5) : options.length } as CSSProperties}
      className={cn(
        "-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 pt-1",
        "md:grid md:snap-none md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] md:overflow-visible md:pb-0",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <motion.button
            key={option.value}
            ref={(node) => (refs.current[index] = node)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={t(option.caption)}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            animate={{ y: selected ? -3 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className={cn(
              "group relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border-2 bg-card text-start",
              large ? "w-[44%] min-[480px]:w-[30%]" : "w-[38%] min-[480px]:w-[26%]",
              "md:w-auto",
              "transition-[border-color,box-shadow] duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15),0_12px_28px_-10px_hsl(var(--primary)/0.55)]"
                : "border-border/60 hover:border-primary/50 hover:shadow-md",
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
                  selected ? "scale-[1.04]" : "group-hover:scale-[1.04]",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white",
                  selected ? "bg-primary" : "bg-black/25",
                )}
              >
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <div className={cn("flex flex-1 flex-col gap-0.5", large ? "p-3" : "p-2")}>
              <span className={cn("font-semibold leading-tight", large ? "text-sm sm:text-base" : "text-sm", selected && "text-primary")}>
                {t(option.label)}
              </span>
              {large && <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{t(option.caption)}</span>}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
