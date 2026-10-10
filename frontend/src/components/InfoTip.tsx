import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Small (i) button that reveals extra detail: sources, assumptions, fine
 * print. Opens on hover and on tap, so it also works on touch screens.
 */
export const InfoTip = ({ children, label = "More information", className }: { children: ReactNode; label?: string; className?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 text-xs leading-relaxed text-muted-foreground"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};
