import { cn } from "@/lib/utils";
import barrel from "@/assets/drawn/barrel.svg?raw";
import chart from "@/assets/drawn/chart.svg?raw";
import cog from "@/assets/drawn/cog.svg?raw";
import cottage from "@/assets/drawn/cottage.svg?raw";
import cross from "@/assets/drawn/cross.svg?raw";
import document from "@/assets/drawn/document.svg?raw";
import drop from "@/assets/drawn/drop.svg?raw";
import droplet from "@/assets/drawn/droplet.svg?raw";
import droplets from "@/assets/drawn/droplets.svg?raw";
import gauge from "@/assets/drawn/gauge.svg?raw";
import house from "@/assets/drawn/house.svg?raw";
import satellite from "@/assets/drawn/satellite.svg?raw";
import tick from "@/assets/drawn/tick.svg?raw";
import warning from "@/assets/drawn/warning.svg?raw";

// Hand-drawn icons from Koboyo (https://koboyo.com), used where icons are
// small: nav items and headings. They are inlined so they take the text
// colour. Larger spots use the 3D icons in Icon3D.
const icons = {
  barrel,
  chart,
  cog,
  cottage,
  cross,
  document,
  drop,
  droplet,
  droplets,
  gauge,
  house,
  satellite,
  tick,
  warning,
};

export type DrawnIconName = keyof typeof icons;

interface DrawnIconProps {
  name: DrawnIconName;
  /** Size and colour via Tailwind classes, like a lucide icon (e.g. "h-5 w-5 text-primary"). */
  className?: string;
}

export const DrawnIcon = ({ name, className }: DrawnIconProps) => (
  <span
    aria-hidden="true"
    className={cn("inline-block shrink-0 [&>svg]:h-full [&>svg]:w-full", className)}
    // Static SVG files from src/assets/drawn, checked into the repo.
    dangerouslySetInnerHTML={{ __html: icons[name] }}
  />
);
