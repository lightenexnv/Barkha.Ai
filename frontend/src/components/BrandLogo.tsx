import { BarkhaLogo } from "@/assets/logo";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** "lockup" = mark + wordmark, "mark" = the B alone */
  variant?: "lockup" | "mark";
  /** Show the "Water Intelligence" tagline under the wordmark */
  tagline?: boolean;
  /** Light wordmark for dark backgrounds */
  inverted?: boolean;
  className?: string;
  markClassName?: string;
}

/** The Barkha.Ai logo. Static by design: the brand mark never bobs or floats. */
export const BrandLogo = ({ variant = "lockup", tagline = false, inverted = false, className, markClassName }: BrandLogoProps) => {
  const mark = (
    <img
      src={BarkhaLogo.markSvg}
      alt={variant === "mark" ? "Barkha.Ai" : ""}
      aria-hidden={variant === "mark" ? undefined : true}
      draggable={false}
      className={cn("h-9 w-9 shrink-0 select-none object-contain", markClassName)}
    />
  );
  if (variant === "mark") return <span className={cn("inline-flex", className)}>{mark}</span>;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Barkha.Ai">
      {mark}
      <span className="flex flex-col">
        <span
          className={cn(
            "text-xl font-bold leading-tight tracking-tight",
            inverted ? "text-white" : "text-[#0B3B6E] dark:text-white",
          )}
        >
          Barkha<span className={inverted ? "text-cyan-300" : "text-[#0277B8] dark:text-cyan-300"}>.Ai</span>
        </span>
        {tagline && (
          <span className={cn("text-[11px] font-medium leading-none", inverted ? "text-white/60" : "text-muted-foreground")}>
            Water Intelligence
          </span>
        )}
      </span>
    </span>
  );
};
