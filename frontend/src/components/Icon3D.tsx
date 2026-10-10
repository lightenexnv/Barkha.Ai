import { cn } from "@/lib/utils";
import calculator from "@/assets/icons/calculator.png";
import coins from "@/assets/icons/coins.png";
import document from "@/assets/icons/document.png";
import drop from "@/assets/icons/drop.png";
import lightning from "@/assets/icons/lightning.png";
import satellite from "@/assets/icons/satellite.png";

// 3D icons from thiings.co (https://www.thiings.co), cropped to 96px PNGs.
// Used where icons are large; small spots use DrawnIcon.
const icons = {
  calculator,
  coins,
  document,
  drop,
  lightning,
  satellite,
};

export type Icon3DName = keyof typeof icons;

interface Icon3DProps {
  name: Icon3DName;
  /** Size via Tailwind classes, like a lucide icon (e.g. "h-6 w-6"). */
  className?: string;
  alt?: string;
}

export const Icon3D = ({ name, className, alt = "" }: Icon3DProps) => (
  <img
    src={icons[name]}
    alt={alt}
    aria-hidden={alt ? undefined : true}
    draggable={false}
    className={cn("inline-block shrink-0 select-none object-contain drop-shadow-sm", className)}
  />
);
