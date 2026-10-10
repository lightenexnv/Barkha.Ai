import { motion } from "framer-motion";
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

type StepState = "completed" | "active" | "upcoming";

// Every step uses the same opaque circle and shows its number; only colour
// changes between states, so the bar reads consistently left to right.
const CIRCLE: Record<StepState, { backgroundColor: string; borderColor: string; color: string; scale: number }> = {
  completed: { backgroundColor: "hsl(var(--primary))", borderColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", scale: 1 },
  active: { backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))", scale: 1.12 },
  upcoming: { backgroundColor: "hsl(var(--muted))", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))", scale: 1 },
};

/** The one progress bar for the whole workflow. */
export const WorkflowStepper = ({ steps, current, reachable, completed, onSelect }: WorkflowStepperProps) => {
  const fill = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
  const edge = `${50 / steps.length}%`;

  return (
    <nav aria-label="Assessment progress" className="glass-card rounded-2xl px-3 py-4 sm:px-6">
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {/* Track and animated fill between the first and last circle */}
        <div aria-hidden="true" className="absolute top-[18px] h-1 rounded-full bg-border" style={{ insetInlineStart: edge, insetInlineEnd: edge }}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={false}
            animate={{ width: `${fill}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>

        {steps.map((step, index) => {
          const locked = index > reachable;
          const state: StepState = index === current ? "active" : completed[index] ? "completed" : "upcoming";
          return (
            <li key={step.id} className="relative flex flex-col items-center">
              <motion.button
                type="button"
                onClick={() => !locked && onSelect(index)}
                disabled={locked}
                aria-current={state === "active" ? "step" : undefined}
                whileHover={locked ? undefined : { y: -2 }}
                whileTap={locked ? undefined : { scale: 0.95 }}
                className={cn(
                  "group flex flex-col items-center gap-2 rounded-lg px-1 text-center outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  locked ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                <span className="relative">
                  {state === "active" && (
                    <motion.span
                      layoutId="stepper-active-ring"
                      className="absolute -inset-1.5 rounded-full bg-primary/20"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <motion.span
                    initial={false}
                    animate={CIRCLE[state]}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums"
                  >
                    {index + 1}
                  </motion.span>
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      "text-xs font-semibold leading-tight transition-colors sm:text-sm",
                      state === "active" ? "text-primary" : state === "completed" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">{step.hint}</span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
