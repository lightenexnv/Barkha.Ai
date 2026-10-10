// Layout and backdrop painting for the landing hero.
//
// The title is painted into a 2D canvas (not HTML) so the water shader can
// refract it together with the 3D scene. Everything is positioned from one
// layout object so the painted title, the waterline, the 3D island and the
// HTML content below stay aligned at every viewport size.

export const TITLE_LINES = ["Intelligent", "Rainwater", "Harvesting", "Assessment"];

const FONT_FAMILY = "Inter, system-ui, sans-serif";
const FONT_WEIGHT = 800;
const DESKTOP_BREAKPOINT = 1024;

// How far the island model (rain cloud to soil) reaches from its anchor,
// as a fraction of its width.
const ISLAND_REACH = { up: 0.6, down: 0.42, side: 0.52 };
// How far below the waterline the island is anchored, as a fraction of its width.
const ISLAND_SINK = -0.16;

export interface HeroLayout {
  isDesktop: boolean;
  gutter: number;
  columnWidth: number;
  fontSize: number;
  letterSpacing: number;
  baselines: number[];
  /** Water surface, in CSS px from the top of the hero. */
  waterline: number;
  /** Top of the HTML block (subtitle, buttons) under the title. */
  contentTop: number;
  /** Where the 3D island is anchored, in CSS px. */
  island: { x: number; y: number; width: number };
  /** Minimum hero height in CSS px. */
  minHeight: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function font(size: number) {
  return `${FONT_WEIGHT} ${size}px ${FONT_FAMILY}`;
}

function applyLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // Canvas letterSpacing is Chromium/Firefox 115+; older engines just ignore it.
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  }
}

/** Width of the widest title line at a 100px font size. */
function widestLineAt100() {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return 560;

  measureCtx.font = font(100);
  applyLetterSpacing(measureCtx, -3.5);
  return Math.max(...TITLE_LINES.map((line) => measureCtx!.measureText(line).width));
}

export function computeHeroLayout(width: number, viewportHeight: number): HeroLayout {
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const widest = widestLineAt100();

  if (isDesktop) {
    const minHeight = Math.max(680, viewportHeight - 64);
    const gutter = Math.max(32, (width - 1280) / 2 + 32);
    // A slightly narrower title column leaves air around the heading and room for the island
    const columnWidth = Math.min(560, width * 0.46 - gutter);

    // Fit the widest word in the column, and the whole hero in the viewport.
    const fontSize = Math.min((columnWidth * 100) / widest, 132, (minHeight - 330) / 3.9);
    const lineHeight = fontSize * 0.96;
    const contentHeight = 250;
    const blockHeight = lineHeight * 4 + fontSize * 0.28 + 28 + contentHeight;
    const titleTop = Math.max(96, (minHeight - blockHeight) / 2 + 28);

    const baselines = TITLE_LINES.map((_, i) => titleTop + lineHeight * i + fontSize * 0.8);
    // The surface cuts through the middle of "Harvesting".
    const waterline = baselines[2] - fontSize * 0.38;
    // Keep the island clear of the title and the rain cloud inside the hero.
    // It sits slightly deeper in the water, which lets it grow without
    // pushing the cloud out of the top of the hero.
    const titleRight = gutter + columnWidth + 32;
    const islandWidth = Math.min(
      820,
      (width - gutter * 0.75 - titleRight) / (2 * ISLAND_REACH.side),
      (waterline - 8) / (ISLAND_REACH.up - ISLAND_SINK),
    );

    return {
      isDesktop,
      gutter,
      columnWidth,
      fontSize,
      letterSpacing: -0.035 * fontSize,
      baselines,
      waterline,
      contentTop: baselines[3] + fontSize * 0.28 + 32,
      island: {
        x: (titleRight + width - gutter * 0.75) / 2,
        y: waterline + islandWidth * ISLAND_SINK,
        width: islandWidth,
      },
      minHeight,
    };
  }

  // Phone and tablet: island floats in the sky, title below it.
  const gutter = width < 640 ? 16 : 32;
  const columnWidth = width - gutter * 2;
  const islandWidth = Math.min(columnWidth * 1.12, 580);
  const islandY = 16 + islandWidth * ISLAND_REACH.up;
  const fontSize = Math.min((columnWidth * 100) / widest, 88);
  const lineHeight = fontSize * 0.96;
  const titleTop = islandY + islandWidth * ISLAND_REACH.down + 40;
  const baselines = TITLE_LINES.map((_, i) => titleTop + lineHeight * i + fontSize * 0.8);
  const waterline = baselines[2] - fontSize * 0.38;

  return {
    isDesktop,
    gutter,
    columnWidth,
    fontSize,
    letterSpacing: -0.035 * fontSize,
    baselines,
    waterline,
    contentTop: baselines[3] + fontSize * 0.3 + 28,
    island: { x: width / 2, y: islandY, width: islandWidth },
    minHeight: 0,
  };
}

/**
 * Paints sky, water and the title. `width`/`height` are CSS px; the canvas
 * backing store is sized by `pixelRatio`.
 */
export function paintBackdrop(
  canvas: HTMLCanvasElement,
  layout: HeroLayout,
  width: number,
  height: number,
  pixelRatio: number,
) {
  const w = Math.max(1, Math.round(width * pixelRatio));
  const h = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { waterline } = layout;

  // Sky
  ctx.fillStyle = "#e6f3fb";
  ctx.fillRect(0, 0, width, waterline);

  // Water
  ctx.fillStyle = "#1572a6";
  ctx.fillRect(0, waterline, width, height - waterline);

  // Title
  const { fontSize, baselines, gutter, isDesktop } = layout;
  ctx.font = font(fontSize);
  applyLetterSpacing(ctx, layout.letterSpacing);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = isDesktop ? "left" : "center";
  const x = isDesktop ? gutter : width / 2;

  const paintLines = (above: boolean) => {
    ctx.save();
    ctx.beginPath();
    if (above) ctx.rect(0, 0, width, waterline);
    else ctx.rect(0, waterline, width, height - waterline);
    ctx.clip();

    TITLE_LINES.forEach((line, i) => {
      const baseline = baselines[i];
      if (i === 0) {
        ctx.fillStyle = above ? "#0a63d1" : "#d6f2ff";
      } else {
        ctx.fillStyle = above ? "#0b2540" : "rgba(236, 249, 255, 0.96)";
      }
      ctx.fillText(line, x, baseline);
    });
    ctx.restore();
  };

  paintLines(true);
  paintLines(false);
}
