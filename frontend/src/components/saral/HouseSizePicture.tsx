import type { RoofSize } from "@/lib/saral";

/** Flat illustrations of the four house sizes, so nobody needs to know their roof area. */
export const HouseSizePicture = ({ size }: { size: RoofSize }) => {
  const sky = "#e0f2fe";
  const ground = "#86c46a";
  return (
    <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden="true">
      <rect width="160" height="110" rx="12" fill={sky} />
      <rect y="88" width="160" height="22" fill={ground} />
      {size === "small" && (
        <g>
          <polygon points="52,52 80,30 108,52" fill="#e76f51" />
          <rect x="58" y="52" width="44" height="36" fill="#f4e1c1" />
          <rect x="74" y="66" width="12" height="22" fill="#a0522d" />
        </g>
      )}
      {size === "medium" && (
        <g>
          <rect x="38" y="44" width="84" height="44" fill="#f4e1c1" />
          <rect x="34" y="38" width="92" height="8" fill="#94a3b8" />
          <rect x="50" y="56" width="16" height="14" fill="#7dd3fc" />
          <rect x="94" y="56" width="16" height="14" fill="#7dd3fc" />
          <rect x="74" y="64" width="12" height="24" fill="#a0522d" />
        </g>
      )}
      {size === "large" && (
        <g>
          <rect x="22" y="40" width="116" height="48" fill="#fde7c7" />
          <rect x="44" y="22" width="72" height="20" fill="#fde7c7" />
          <rect x="18" y="36" width="124" height="6" fill="#94a3b8" />
          <rect x="40" y="18" width="80" height="6" fill="#94a3b8" />
          {[32, 56, 96, 120].map((x) => (
            <rect key={x} x={x} y="52" width="14" height="14" fill="#7dd3fc" />
          ))}
          <rect x="74" y="62" width="14" height="26" fill="#a0522d" />
          <circle cx="12" cy="76" r="9" fill="#4ade80" />
          <circle cx="150" cy="78" r="8" fill="#4ade80" />
        </g>
      )}
      {size === "building" && (
        <g>
          <rect x="40" y="10" width="80" height="78" fill="#cbd5e1" />
          <rect x="36" y="6" width="88" height="6" fill="#64748b" />
          {[18, 32, 46, 60].map((y) =>
            [48, 66, 84, 102].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="10" height="9" fill="#7dd3fc" />),
          )}
          <rect x="72" y="74" width="16" height="14" fill="#475569" />
        </g>
      )}
    </svg>
  );
};
