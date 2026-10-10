import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  label: string;
  hint: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  current: number;
  /** Furthest step the user may open; steps after it are locked */
  reachable: number;
  /** Steps whose inputs are complete */
  completed: boolean[];
  onSelect: (index: number) => void;
}

/** The one progress bar for the whole workflow. */
export const WorkflowStepper = ({ steps, current, reachable, completed, onSelect }: WorkflowStepperProps) => {
  const fill = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  return (
    <nav aria-label="Assessment progress" className="glass-card rounded-2xl px-3 py-4 sm:px-6">
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {/* Track and animated fill, running between the first and last dot */}
        <div
          aria-hidden="true"
          className="absolute top-[18px] h-1 rounded-full bg-border"
          style={{ insetInlineStart: `${50 / steps.length}%`, insetInlineEnd: `${50 / steps.length}%` }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700 ease-out"
            style={{ width: `${fill}%` }}
          />
        </div>

        {steps.map((step, index) => {
          const locked = index > reachable;
          const isCurrent = index === current;
          const done = completed[index] && !isCurrent;
          return (
            <li key={step.id} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => !locked && onSelect(index)}
                disabled={locked}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-2 rounded-lg px-1 text-center outline-none transition-opacity",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  locked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                    isCurrent && "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_hsl(var(--primary)/0.18)]",
                    done && "border-primary bg-background text-primary group-hover:bg-primary/10",
                    !isCurrent && !done && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      "text-xs font-semibold leading-tight sm:text-sm",
                      isCurrent ? "text-primary" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">{step.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
