import { cn } from "@/lib/utils";
import barChart from "@/assets/icons/bar-chart.png";
import calculator from "@/assets/icons/calculator.png";
import checkMark from "@/assets/icons/check-mark.png";
import coins from "@/assets/icons/coins.png";
import document from "@/assets/icons/document.png";
import drop from "@/assets/icons/drop.png";
import gauge from "@/assets/icons/gauge.png";
import gear from "@/assets/icons/gear.png";
import house from "@/assets/icons/house.png";
import lightning from "@/assets/icons/lightning.png";
import logoDrops from "@/assets/icons/logo-drops.png";
import roof from "@/assets/icons/roof.png";
import satellite from "@/assets/icons/satellite.png";
import trendingUp from "@/assets/icons/trending-up.png";
import warningSign from "@/assets/icons/warning-sign.png";
import waterTank from "@/assets/icons/water-tank.png";
import xMark from "@/assets/icons/x-mark.png";

// 3D icons from thiings.co (https://www.thiings.co), cropped to 96px PNGs.
const icons = {
  barChart,
  calculator,
  checkMark,
  coins,
  document,
  drop,
  gauge,
  gear,
  house,
  lightning,
  logoDrops,
  roof,
  satellite,
  trendingUp,
  warningSign,
  waterTank,
  xMark,
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
