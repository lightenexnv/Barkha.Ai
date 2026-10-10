"""
Pin-to-roof detection.

Given the point a user pinned on the satellite map, fetch the surrounding
imagery, segment the roof that contains the pin and return its outline as a
lat/lon polygon together with its ground area in m².

Pipeline: Web-Mercator tile mosaic (grown when the roof reaches its edge) →
optional contrast enhancement for hazy imagery → mean-shift smoothing →
seeded flood fill with an adaptive colour tolerance (stops before the region
leaks into the surroundings, trees or a road) → GrabCut refinement with trees
and cast shadows held as background → morphological clean-up → orthogonal,
edge-snapped outline → geometry validation with fallbacks.

Every threshold lives in RoofDetectionConfig and can be overridden with a
ROOF_<FIELD> environment variable (e.g. ROOF_VEGETATION_FILTER=false), so
settings can be compared on labelled data with services/roof_evaluation.py.
"""
import logging
import math
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, fields, replace
from functools import lru_cache
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import requests
from PIL import Image

logger = logging.getLogger(__name__)

TILE_SIZE = 256
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
HEADERS = {"User-Agent": "BarkhaAI-RoofDetection/2.0 (+https://barkha-ai.vercel.app)"}
EARTH_CIRCUMFERENCE = 40075016.686  # metres at the equator


@dataclass(frozen=True)
class RoofDetectionConfig:
    # Imagery
    zoom_levels: Tuple[int, ...] = (19, 18, 17)
    grid_radius: int = 1          # 3 × 3 tiles around the pin
    max_grid_radius: int = 2      # grow to 5 × 5 when the roof reaches the mosaic edge
    # Plausible roofs
    min_roof_m2: float = 12.0
    max_roof_m2: float = 6000.0
    min_roof_width_m: float = 2.5  # narrower outlines are walls, paths or slivers
    max_elongation: float = 12.0   # length / width beyond this (and > road_min_length_m) reads as a road
    road_min_length_m: float = 30.0
    min_confidence: float = 0.0    # 0 keeps every plausible outline
    # Region growing
    flood_tolerances: Tuple[int, ...] = (6, 9, 12, 15, 19, 24, 30)
    leak_growth_ratio: float = 2.2
    leak_min_m2: float = 60.0
    meanshift_spatial_m: float = 2.0
    meanshift_colour: int = 20
    grabcut_iterations: int = 4
    grabcut_min_ratio: float = 0.6
    grabcut_max_ratio: float = 1.6
    # Preprocessing: "auto" enhances only low-contrast imagery; "on" / "off" force it
    contrast_enhance: str = "auto"
    low_contrast_std: float = 22.0
    # Trees and grass: green (excess-green index) and textured, unlike smooth green-painted sheets
    vegetation_filter: bool = True
    vegetation_exg: float = 0.10
    vegetation_exg_abs: float = 20.0  # grey levels; the ratio alone is unstable on dark shadows and black tanks
    vegetation_texture: float = 9.0
    seed_vegetation_max: float = 0.6   # pin rejected when this share of its surroundings is vegetation
    leak_vegetation_max: float = 0.35  # growth step rejected when this share of the new pixels is vegetation
    # Cast shadows: very dark pixels outside the roof are held as background in GrabCut
    shadow_filter: bool = True
    shadow_value_max: int = 55


def parse_config_value(raw: str, default: Any) -> Any:
    """Parse a string override into the type of the field's default."""
    if isinstance(default, bool):
        if raw.strip().lower() in ("1", "true", "yes", "on"):
            return True
        if raw.strip().lower() in ("0", "false", "no", "off"):
            return False
        raise ValueError(f"not a boolean: {raw!r}")
    if isinstance(default, tuple):
        return tuple(int(v) for v in raw.split(",") if v.strip())
    if isinstance(default, int):
        return int(raw)
    if isinstance(default, float):
        return float(raw)
    return raw.strip()


def config_with(base: Optional[RoofDetectionConfig] = None, **overrides: Any) -> RoofDetectionConfig:
    config = replace(base or CONFIG, **overrides)
    if config.contrast_enhance not in ("auto", "on", "off"):
        raise ValueError("contrast_enhance must be auto, on or off")
    if not config.zoom_levels or config.max_grid_radius < config.grid_radius:
        raise ValueError("zoom_levels must be non-empty and max_grid_radius >= grid_radius")
    return config


def _config_from_env() -> RoofDetectionConfig:
    base = RoofDetectionConfig()
    overrides = {}
    for field in fields(base):
        raw = os.getenv(f"ROOF_{field.name.upper()}")
        if raw is None:
            continue
        try:
            overrides[field.name] = parse_config_value(raw, getattr(base, field.name))
        except ValueError as e:
            logger.warning(f"Ignoring ROOF_{field.name.upper()}={raw!r}: {e}")
    try:
        return config_with(base, **overrides)
    except ValueError as e:
        logger.warning(f"Ignoring roof detection overrides: {e}")
        return base


CONFIG = _config_from_env()
# Kept for callers that read the old module constants
MIN_ROOF_M2 = CONFIG.min_roof_m2
MAX_ROOF_M2 = CONFIG.max_roof_m2
GRID_RADIUS = CONFIG.grid_radius


class RoofDetectionError(Exception):
    pass


class _PinNotOnRoof(RoofDetectionError):
    """The pin is on something that is clearly not a roof; other zoom levels will not help."""


class _RoofAtMosaicEdge(Exception):
    """The roof may continue past the mosaic; retry with a larger one."""


def metres_per_pixel(latitude: float, zoom: int) -> float:
    return EARTH_CIRCUMFERENCE * math.cos(math.radians(latitude)) / (TILE_SIZE * 2 ** zoom)


def _world_pixel(latitude: float, longitude: float, zoom: int) -> Tuple[float, float]:
    scale = TILE_SIZE * 2 ** zoom
    x = (longitude + 180.0) / 360.0 * scale
    lat = math.radians(latitude)
    y = (1.0 - math.log(math.tan(lat) + 1.0 / math.cos(lat)) / math.pi) / 2.0 * scale
    return x, y


def _world_to_latlon(x: float, y: float, zoom: int) -> Tuple[float, float]:
    scale = TILE_SIZE * 2 ** zoom
    longitude = x / scale * 360.0 - 180.0
    latitude = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / scale))))
    return latitude, longitude


@lru_cache(maxsize=512)
def _fetch_tile(z: int, x: int, y: int) -> Optional[bytes]:
    try:
        response = requests.get(TILE_URL.format(z=z, x=x, y=y), headers=HEADERS, timeout=12)
        if response.status_code == 200 and response.content:
            return response.content
    except requests.RequestException as e:
        logger.warning(f"Tile {z}/{x}/{y} failed: {e}")
    return None


def _mosaic(latitude: float, longitude: float, zoom: int, radius: int = GRID_RADIUS) -> Tuple[np.ndarray, int, int]:
    """(2·radius + 1)² tile mosaic around the point; returns BGR image and its world-pixel origin."""
    px, py = _world_pixel(latitude, longitude, zoom)
    tile_x, tile_y = int(px // TILE_SIZE), int(py // TILE_SIZE)
    coords = [(tile_x + dx, tile_y + dy) for dy in range(-radius, radius + 1) for dx in range(-radius, radius + 1)]
    with ThreadPoolExecutor(max_workers=9) as pool:
        tiles = list(pool.map(lambda c: _fetch_tile(zoom, c[0], c[1]), coords))
    if any(t is None for t in tiles):
        raise RoofDetectionError("Satellite imagery could not be downloaded for this location.")
    if any(_is_placeholder_tile(t) for t in tiles):
        raise RoofDetectionError("No high-resolution imagery here at this zoom.")

    side = (2 * radius + 1) * TILE_SIZE
    canvas = Image.new("RGB", (side, side))
    for (cx, cy), data in zip(coords, tiles):
        tile = Image.open(BytesIO(data)).convert("RGB")
        canvas.paste(tile, ((cx - tile_x + radius) * TILE_SIZE, (cy - tile_y + radius) * TILE_SIZE))
    image = cv2.cvtColor(np.array(canvas), cv2.COLOR_RGB2BGR)
    origin_x = (tile_x - radius) * TILE_SIZE
    origin_y = (tile_y - radius) * TILE_SIZE
    return image, origin_x, origin_y


@lru_cache(maxsize=1024)
def _is_placeholder_tile(data: bytes) -> bool:
    """
    Where a zoom level has no imagery, Esri still answers HTTP 200 with a flat
    grey "Map data not yet available" tile. About 94% of its pixels share one
    grey value; real imagery, even a bare field, stays far below 50%.
    """
    try:
        grey = np.asarray(Image.open(BytesIO(data)).convert("L"))
    except Exception:
        return True
    _, counts = np.unique(grey, return_counts=True)
    return counts.max() / grey.size > 0.5


# ---------- scene cues ----------

def _enhance_contrast(image: np.ndarray, seed: Tuple[int, int], mpp: float, cfg: RoofDetectionConfig) -> Tuple[np.ndarray, str]:
    """
    CLAHE on lightness, applied in "auto" mode only to hazy or flat imagery
    whose grey spread near the pin is low. Already crisp imagery is left
    untouched, since enhancement also amplifies roof texture that the flood
    fill must ignore. Whether it helps should be checked on labelled cases
    (roof_evaluation --set contrast_enhance=off / on).
    """
    if cfg.contrast_enhance == "off":
        return image, "none"
    if cfg.contrast_enhance == "auto":
        half = max(16, int(round(40 / mpp)))  # ≈ 80 m window around the pin
        x, y = seed
        window = image[max(0, y - half):y + half, max(0, x - half):x + half]
        if float(cv2.cvtColor(window, cv2.COLOR_BGR2GRAY).std()) >= cfg.low_contrast_std:
            return image, "none"
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[..., 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), "clahe"


def _local_std(grey: np.ndarray, size: int) -> np.ndarray:
    grey = grey.astype(np.float32)
    mean = cv2.blur(grey, (size, size))
    mean_sq = cv2.blur(grey * grey, (size, size))
    return np.sqrt(np.maximum(mean_sq - mean * mean, 0))


def _vegetation_mask(image: np.ndarray, mpp: float, cfg: RoofDetectionConfig) -> np.ndarray:
    """Trees and grass: green and textured. Smooth green-painted roof sheets are excluded by the texture test."""
    if not cfg.vegetation_filter:
        return np.zeros(image.shape[:2], np.uint8)
    b, g, r = (image[..., i].astype(np.float32) for i in range(3))
    excess_green = (2 * g - r - b) / (r + g + b + 1.0)
    texture = _local_std(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), max(3, int(round(1.5 / mpp)) | 1))
    mask = ((excess_green > cfg.vegetation_exg) & (2 * g - r - b > cfg.vegetation_exg_abs)
            & (texture > cfg.vegetation_texture)).astype(np.uint8)
    k = max(3, int(round(0.8 / mpp)) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    # Close gaps inside canopies, then drop isolated green specks on roofs
    return cv2.morphologyEx(cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)


def _shadow_mask(image: np.ndarray, cfg: RoofDetectionConfig) -> np.ndarray:
    if not cfg.shadow_filter:
        return np.zeros(image.shape[:2], np.uint8)
    value = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)[..., 2]
    return (value <= cfg.shadow_value_max).astype(np.uint8)


def _rect_sides(mask: np.ndarray) -> Tuple[float, float]:
    """(short, long) sides in pixels of the minimum-area rectangle around a mask."""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0, 0.0
    (_, _), (w, h), _ = cv2.minAreaRect(max(contours, key=cv2.contourArea))
    return float(min(w, h)), float(max(w, h))


def _road_like(mask: np.ndarray, mpp: float, cfg: RoofDetectionConfig) -> bool:
    short, long = _rect_sides(mask)
    return long * mpp > cfg.road_min_length_m and long > cfg.max_elongation * max(short, 1.0)


def _component_at(mask: np.ndarray, seed: Tuple[int, int]) -> np.ndarray:
    count, labels = cv2.connectedComponents(mask.astype(np.uint8))
    label = labels[seed[1], seed[0]]
    if count <= 1 or label == 0:
        return np.zeros_like(mask, dtype=np.uint8)
    return (labels == label).astype(np.uint8)


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    return filled


def _touches_border(mask: np.ndarray, margin: int = 2) -> bool:
    return bool(mask[:margin].any() or mask[-margin:].any() or mask[:, :margin].any() or mask[:, -margin:].any())


def _flood(smoothed: np.ndarray, seed: Tuple[int, int], tolerance: int) -> np.ndarray:
    h, w = smoothed.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    diff = (tolerance,) * 3
    flags = 4 | cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    cv2.floodFill(smoothed.copy(), mask, seed, (0, 0, 0), diff, diff, flags)
    return (mask[1:-1, 1:-1] > 0).astype(np.uint8)


def _clean(mask: np.ndarray, seed: Tuple[int, int], mpp: float) -> np.ndarray:
    k = max(3, int(round(0.9 / mpp)) | 1)  # ≈ 1 m structuring element
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = _fill_holes(mask)
    component = _component_at(mask, seed)
    if not component.any():
        # Opening can remove a thin seed region; fall back to the nearest blob
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            best = min(contours, key=lambda c: abs(cv2.pointPolygonTest(c, seed, True)))
            component = np.zeros_like(mask)
            cv2.drawContours(component, [best], -1, 1, thickness=cv2.FILLED)
    return component


def _near_border(mask: np.ndarray, margin: int) -> bool:
    ys, xs = np.where(mask > 0)
    h, w = mask.shape
    return bool(len(xs)) and (xs.min() < margin or ys.min() < margin or xs.max() >= w - margin or ys.max() >= h - margin)


def _adaptive_flood(smoothed: np.ndarray, seed: Tuple[int, int], mpp: float,
                    cfg: RoofDetectionConfig = CONFIG,
                    vegetation: Optional[np.ndarray] = None) -> Tuple[np.ndarray, int, bool]:
    """
    Grow the region with rising tolerance and stop just before it leaks: past
    the size limit, out of the image, by a sudden jump, into trees, or along a
    road. Also reports whether the result may be cut off by the image edge.
    """
    max_px = cfg.max_roof_m2 / mpp ** 2
    edge_margin = max(4, int(round(10 / mpp)))  # a roof within ≈ 10 m of the edge may continue past it
    previous, previous_tol = None, 0
    stopped_at_border = leaked = False
    region = np.zeros_like(smoothed[..., 0])
    for tolerance in cfg.flood_tolerances:
        region = _clean(_flood(smoothed, seed, tolerance), seed, mpp)
        area = int(region.sum())
        if area == 0:
            continue  # nothing grew at this tolerance yet
        grown = region if previous is None else region & (1 - previous)
        into_vegetation = (
            vegetation is not None and previous is not None
            and grown.sum() * mpp ** 2 > 4
            and float(vegetation[grown > 0].mean()) > cfg.leak_vegetation_max
        )
        at_border = _touches_border(region)
        leaked = (
            area > max_px
            or at_border
            or (previous is not None and previous.sum() > 0 and area > cfg.leak_growth_ratio * previous.sum()
                and area * mpp ** 2 > cfg.leak_min_m2)
            or into_vegetation
            or _road_like(region, mpp, cfg)
        )
        if leaked:
            stopped_at_border = at_border and area <= max_px
            break
        previous, previous_tol = region, tolerance
    if previous is None or previous.sum() == 0:
        if leaked and _road_like(region, mpp, cfg) and not stopped_at_border:
            raise _PinNotOnRoof("The pin looks like it is on a road or path, not a roof. Pin the middle of the roof.")
        if stopped_at_border:
            raise _RoofAtMosaicEdge("The surface at the pin reaches the edge of the imagery.")
        raise RoofDetectionError("No roof surface found at the pin. Place the pin in the middle of the roof.")
    may_be_cut = stopped_at_border and _near_border(previous, edge_margin)
    return previous, previous_tol, may_be_cut


def _grabcut_refine(image: np.ndarray, region: np.ndarray, seed: Tuple[int, int], mpp: float,
                    cfg: RoofDetectionConfig = CONFIG,
                    background: Optional[np.ndarray] = None) -> np.ndarray:
    band = max(4, int(round(4 / mpp)))  # ≈ 4 m uncertain band around the flood region
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
    inner = cv2.erode(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (band, band)))
    outer = cv2.dilate(region, kernel)

    gc = np.full(region.shape, cv2.GC_BGD, np.uint8)
    gc[outer > 0] = cv2.GC_PR_BGD
    gc[region > 0] = cv2.GC_PR_FGD
    if background is not None:
        # Trees and cast shadows next to the roof are never roof
        gc[(background > 0) & (region == 0)] = cv2.GC_BGD
    gc[inner > 0] = cv2.GC_FGD
    cv2.circle(gc, seed, max(2, int(1.5 / mpp)), cv2.GC_FGD, -1)

    # Work on a crop around the region for speed
    ys, xs = np.where(outer > 0)
    pad = band * 2
    y0, y1 = max(0, ys.min() - pad), min(region.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(region.shape[1], xs.max() + pad + 1)
    crop_mask = gc[y0:y1, x0:x1].copy()
    if not ((crop_mask == cv2.GC_BGD) | (crop_mask == cv2.GC_PR_BGD)).any():
        return region
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(image[y0:y1, x0:x1], crop_mask, None, bgd, fgd, cfg.grabcut_iterations, cv2.GC_INIT_WITH_MASK)
    except cv2.error as e:
        logger.info(f"GrabCut skipped: {e}")
        return region
    refined = np.zeros_like(region)
    refined[y0:y1, x0:x1] = ((crop_mask == cv2.GC_FGD) | (crop_mask == cv2.GC_PR_FGD)).astype(np.uint8)
    refined = _clean(refined, seed, mpp)
    ratio = refined.sum() / max(1, region.sum())
    # Accept the refinement only if it stays close to the flood estimate
    return refined if cfg.grabcut_min_ratio <= ratio <= cfg.grabcut_max_ratio and not _touches_border(refined) else region


# ---------- outline rectification ----------
# A segmentation mask follows roof texture, so its outline is ragged: corners
# are shaved off by polygon simplification, clutter (tanks, panels, parapet
# shadows) bites notches into it, and a min-area rectangle of a noisy blob is
# slightly rotated. Buildings are rectilinear, so the outline is rebuilt as an
# orthogonal polygon aligned with the building edge direction, and every wall
# is then snapped to the strongest nearby edge in the imagery.

def _upright_angle(grey: np.ndarray, region: np.ndarray, mpp: float) -> float:
    """
    Rotation (degrees, for cv2.getRotationMatrix2D) that makes the building's
    walls horizontal and vertical. Edge-direction histograms are biased by
    pixel stair-steps on slanted edges, so instead the edge map around the
    roof is rotated through candidate angles and the angle whose row and
    column projections are sharpest (edges lined up) wins, as in document
    deskewing.
    """
    band = max(3, int(round(2.0 / mpp)))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2 * band + 1, 2 * band + 1))
    near = cv2.dilate(region, kernel)
    ys, xs = np.where(near > 0)
    if len(xs) == 0:
        return 0.0
    pad = band
    y0, y1 = max(0, ys.min() - pad), min(grey.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(grey.shape[1], xs.max() + pad + 1)
    crop = cv2.GaussianBlur(grey[y0:y1, x0:x1], (3, 3), 0).astype(np.float32)
    weight = near[y0:y1, x0:x1].astype(np.float32)
    h, w = crop.shape
    centre = (w / 2.0, h / 2.0)

    def sharpness(angle: float) -> float:
        # Horizontal walls must line up in rows and vertical walls in columns.
        # Directional gradients (not plain edge energy) keep roof texture and
        # the mask's own shape from pulling the angle.
        matrix = cv2.getRotationMatrix2D(centre, angle, 1.0)
        rotated = cv2.warpAffine(crop, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        mask = cv2.warpAffine(weight, matrix, (w, h), flags=cv2.INTER_NEAREST)
        gy = np.abs(cv2.Sobel(rotated, cv2.CV_32F, 0, 1, ksize=3)) * mask
        gx = np.abs(cv2.Sobel(rotated, cv2.CV_32F, 1, 0, ksize=3)) * mask
        strong = np.percentile(np.concatenate([gy[mask > 0], gx[mask > 0]]), 80) if mask.any() else 0
        gy[gy < strong] = 0
        gx[gx < strong] = 0
        return float((gy.sum(axis=1) ** 2).sum() + (gx.sum(axis=0) ** 2).sum())

    coarse = max(np.arange(-45.0, 45.0, 1.0), key=sharpness)
    return float(max(np.arange(coarse - 1.0, coarse + 1.01, 0.1), key=sharpness))


def _orthogonal_mask(mask: np.ndarray, seed: Tuple[int, int], mpp: float) -> np.ndarray:
    """Redraw an upright mask on a ~1 m grid so every wall is horizontal or vertical."""
    cell = max(2, int(round(1.0 / mpp)))
    h, w = mask.shape
    gh, gw = max(1, h // cell), max(1, w // cell)
    coarse = cv2.resize(mask[: gh * cell, : gw * cell].astype(np.float32), (gw, gh), interpolation=cv2.INTER_AREA) >= 0.5
    coarse = coarse.astype(np.uint8)
    coarse = cv2.morphologyEx(coarse, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))  # fill notches up to ~2 m
    coarse = cv2.morphologyEx(coarse, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))   # drop 1 m slivers
    coarse = _fill_holes(coarse)
    seed_cell = (min(gw - 1, seed[0] // cell), min(gh - 1, seed[1] // cell))
    component = _component_at(coarse, seed_cell)
    if not component.any():
        component = coarse
    full = np.zeros_like(mask)
    full[: gh * cell, : gw * cell] = cv2.resize(component, (gw * cell, gh * cell), interpolation=cv2.INTER_NEAREST)
    return full


def _orthogonal_outline(mask: np.ndarray) -> np.ndarray:
    """Corners of an orthogonal mask outline, or of its bounding box when nearly rectangular."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(contour)
    if cv2.contourArea(contour) >= 0.84 * w * h or len(contour) > 16:
        return np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], np.float32)
    points = contour.reshape(-1, 2).astype(np.float32)
    # Contour points are pixel centres; push right and bottom walls out by a
    # pixel so the outline encloses the cells instead of cutting through them
    cx, cy = points[:, 0].mean(), points[:, 1].mean()
    points[:, 0] += (points[:, 0] > cx) * 1.0
    points[:, 1] += (points[:, 1] > cy) * 1.0
    return points


def _edge_strength(grad: np.ndarray, horizontal: bool, position: float, start: float, end: float) -> float:
    """Mean edge strength along a wall at `position`, over the middle 70% of its span."""
    a, b = sorted((start, end))
    trim = 0.15 * (b - a)
    a, b = int(round(a + trim)), int(round(b - trim))
    pos = int(round(position))
    if b <= a:
        return 0.0
    if horizontal:
        if not 0 <= pos < grad.shape[0]:
            return 0.0
        return float(grad[pos, max(0, a):min(grad.shape[1], b)].mean())
    if not 0 <= pos < grad.shape[1]:
        return 0.0
    return float(grad[max(0, a):min(grad.shape[0], b), pos].mean())


def _strip_blocked(blocked: np.ndarray, horizontal: bool, a: float, b: float, start: float, end: float) -> float:
    """Share of background (tree/shadow) pixels in the strip a wall would sweep moving from a to b."""
    lo, hi = sorted((int(round(a)), int(round(b))))
    s0, s1 = sorted((int(round(start)), int(round(end))))
    trim = int(0.15 * (s1 - s0))
    s0, s1 = s0 + trim, s1 - trim
    if s1 <= s0:
        return 0.0
    strip = blocked[lo:hi + 1, max(0, s0):s1] if horizontal else blocked[max(0, s0):s1, lo:hi + 1]
    return float(strip.mean()) if strip.size else 0.0


def _snap_walls(points: np.ndarray, grey: np.ndarray, mpp: float, blocked: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Move every wall of an orthogonal polygon onto the strongest nearby image
    edge. A wall never grows outward across cast shadow or tree canopy: the
    outer edge of a shadow is often the strongest edge near a roof.
    """
    n = len(points)
    blurred = cv2.GaussianBlur(grey, (3, 3), 0).astype(np.float32)
    grad_y = np.abs(cv2.Sobel(blurred, cv2.CV_32F, 0, 1, ksize=3))  # edges of horizontal walls
    grad_x = np.abs(cv2.Sobel(blurred, cv2.CV_32F, 1, 0, ksize=3))  # edges of vertical walls
    centre = points.mean(axis=0)
    # Walls may grow outward further (clutter makes the mask too small) than inward
    outward, inward = int(round(2.5 / mpp)), int(round(1.5 / mpp))

    walls = []  # (is_horizontal, position)
    for i in range(n):
        p, q = points[i], points[(i + 1) % n]
        horizontal = abs(p[1] - q[1]) < abs(p[0] - q[0])
        position = (p[1] + q[1]) / 2 if horizontal else (p[0] + q[0]) / 2
        span = (p[0], q[0]) if horizontal else (p[1], q[1])
        grad = grad_y if horizontal else grad_x
        sign = 1 if position > (centre[1] if horizontal else centre[0]) else -1  # +1 points outward
        base = _edge_strength(grad, horizontal, position, *span)
        best, best_score = position, base
        for step in range(-inward, outward + 1):
            if step == 0:
                continue
            candidate = position + sign * step
            if step > 0 and blocked is not None and _strip_blocked(blocked, horizontal, position, candidate, *span) > 0.5:
                break  # steps only grow outward from here
            # Slight preference for nearby edges over distant ones of similar strength
            score = _edge_strength(grad, horizontal, candidate, *span) * (1 - 0.04 * abs(step) * mpp)
            if score > best_score:
                best, best_score = candidate, score
        walls.append((horizontal, best if best_score > 1.15 * base else position))

    snapped = np.zeros_like(points)
    for i in range(n):
        h_prev, pos_prev = walls[i - 1]
        h_cur, pos_cur = walls[i]
        if h_prev == h_cur:  # walls do not alternate here: keep the vertex
            snapped[i] = points[i]
        elif h_cur:
            snapped[i] = (pos_prev, pos_cur)
        else:
            snapped[i] = (pos_cur, pos_prev)
    return snapped


def _rectify(image: np.ndarray, region: np.ndarray, seed: Tuple[int, int], mpp: float,
             background: Optional[np.ndarray] = None) -> Tuple[np.ndarray, float]:
    """Orthogonal, edge-snapped roof outline in original pixel coordinates, plus rectangularity."""
    grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    angle = _upright_angle(grey, region, mpp)
    h, w = region.shape
    centre = (float(seed[0]), float(seed[1]))
    matrix = cv2.getRotationMatrix2D(centre, angle, 1.0)
    rotated = cv2.warpAffine(region, matrix, (w, h), flags=cv2.INTER_NEAREST)
    if not rotated.any():
        raise RoofDetectionError("Roof outline could not be traced.")

    rotated_grey = cv2.warpAffine(grey, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    rotated_seed = cv2.transform(np.array([[centre]], np.float32), matrix)[0, 0]
    upright = _orthogonal_mask(rotated, (int(rotated_seed[0]), int(rotated_seed[1])), mpp)
    points = _orthogonal_outline(upright)
    rotated_background = None
    if background is not None:
        rotated_background = cv2.warpAffine(background, matrix, (w, h), flags=cv2.INTER_NEAREST) & (1 - upright)
    snapped = _snap_walls(points, rotated_grey, mpp, rotated_background)
    before, after = _polygon_area(points), _polygon_area(snapped)
    if before > 0 and 0.6 <= after / before <= 1.7:
        points = snapped

    inverse = cv2.invertAffineTransform(matrix)
    original = cv2.transform(points.reshape(-1, 1, 2), inverse).reshape(-1, 2)
    rectangularity = float(region.sum() / max(1.0, _polygon_area(original)))
    return original.astype(np.float32), min(1.0, rectangularity)


def _polygon(mask: np.ndarray) -> Tuple[np.ndarray, float]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(contour)
    rect = cv2.minAreaRect(contour)
    rect_area = rect[1][0] * rect[1][1]
    rectangularity = area / rect_area if rect_area > 0 else 0
    if rectangularity >= 0.88:
        points = cv2.boxPoints(rect)
    else:
        epsilon = 0.012 * cv2.arcLength(contour, True)
        points = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2).astype(np.float32)
        if len(points) < 4:
            points = cv2.boxPoints(rect)
    return points, rectangularity


def _polygon_area(points: np.ndarray) -> float:
    x, y = points[:, 0], points[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


# ---------- outline validation ----------

def _tidy(points: np.ndarray) -> np.ndarray:
    """Drop repeated and collinear vertices, which add nothing but can confuse later checks."""
    points = np.asarray(points, np.float32).reshape(-1, 2)
    changed = True
    while changed and len(points) > 3:
        changed = False
        keep = []
        n = len(points)
        for i in range(n):
            prev, cur, nxt = points[i - 1], points[i], points[(i + 1) % n]
            twice_area = abs((cur[0] - prev[0]) * (nxt[1] - prev[1]) - (cur[1] - prev[1]) * (nxt[0] - prev[0]))
            if np.hypot(*(cur - prev)) < 0.5 or twice_area < 0.5:
                changed = True
                continue
            keep.append(cur)
        if len(keep) < 3:
            break
        points = np.array(keep, np.float32)
    return points


def _segments_cross(p1: np.ndarray, p2: np.ndarray, q1: np.ndarray, q2: np.ndarray) -> bool:
    def orient(a, b, c):
        return np.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
    return orient(p1, p2, q1) * orient(p1, p2, q2) < 0 and orient(q1, q2, p1) * orient(q1, q2, p2) < 0


def _self_intersects(points: np.ndarray) -> bool:
    n = len(points)
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue  # neighbours through the closing edge
            if _segments_cross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]):
                return True
    return False


def _outline_ok(points: np.ndarray, region: np.ndarray) -> bool:
    """A usable outline is a simple polygon whose area agrees with the segmented mask."""
    if len(points) < 3 or not np.isfinite(points).all():
        return False
    area = _polygon_area(points)
    if area <= 0 or _self_intersects(points):
        return False
    return 0.5 <= area / max(1.0, float(region.sum())) <= 2.0


def _outline(image: np.ndarray, region: np.ndarray, seed: Tuple[int, int], mpp: float,
             background: Optional[np.ndarray] = None) -> Tuple[np.ndarray, float, str]:
    """Best valid outline: rectified, then simplified contour, then minimum-area rectangle."""
    try:
        points, rectangularity = _rectify(image, region, seed, mpp, background)
        points = _tidy(points)
        if _outline_ok(points, region):
            return points, rectangularity, "orthogonal"
        logger.info("Rectified outline failed validation; using the simplified contour")
    except (RoofDetectionError, cv2.error, ValueError) as e:
        logger.info(f"Outline rectification skipped: {e}")
    points, rectangularity = _polygon(region)
    points = _tidy(points)
    if _outline_ok(points, region):
        return points, rectangularity, "contour"
    contours, _ = cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        box = cv2.boxPoints(cv2.minAreaRect(max(contours, key=cv2.contourArea))).astype(np.float32)
        if _outline_ok(box, region):
            return box, min(1.0, float(region.sum()) / max(1.0, _polygon_area(box))), "rectangle"
    raise RoofDetectionError("Roof outline could not be traced. Re-pin nearer the roof centre.")


def detect_roof(latitude: float, longitude: float, config: Optional[RoofDetectionConfig] = None) -> Dict[str, Any]:
    cfg = config or CONFIG
    last_error: Optional[Exception] = None
    detection_error: Optional[Exception] = None
    # Coverage depth varies by place; use the deepest level with real imagery
    for zoom in cfg.zoom_levels:
        radius, force_edge = cfg.grid_radius, False
        while True:
            try:
                image, origin_x, origin_y = _mosaic(latitude, longitude, zoom, radius)
            except RoofDetectionError as e:
                if radius > cfg.grid_radius:
                    # The larger mosaic is unavailable; accept the roof as the smaller one shows it
                    radius, force_edge = radius - 1, True
                    continue
                last_error = e
                break
            try:
                return _detect_in_image(image, origin_x, origin_y, latitude, longitude, zoom, cfg,
                                        allow_edge=force_edge or radius >= cfg.max_grid_radius)
            except _RoofAtMosaicEdge:
                radius += 1
            except _PinNotOnRoof:
                raise
            except RoofDetectionError as e:
                detection_error = e
                break
    raise detection_error or last_error or RoofDetectionError("Roof detection failed.")


def _detect_in_image(image: np.ndarray, origin_x: int, origin_y: int, latitude: float, longitude: float, zoom: int,
                     cfg: RoofDetectionConfig = CONFIG, allow_edge: bool = True) -> Dict[str, Any]:
    mpp = metres_per_pixel(latitude, zoom)
    wx, wy = _world_pixel(latitude, longitude, zoom)
    seed = (int(round(wx - origin_x)), int(round(wy - origin_y)))
    h, w = image.shape[:2]
    if not (0 <= seed[0] < w and 0 <= seed[1] < h):
        raise RoofDetectionError("The pin is outside the downloaded imagery.")

    work, preprocessing = _enhance_contrast(image, seed, mpp, cfg)
    vegetation = _vegetation_mask(image, mpp, cfg)
    disk = np.zeros((h, w), np.uint8)
    cv2.circle(disk, seed, max(2, int(round(1.5 / mpp))), 1, -1)
    if cfg.vegetation_filter and float(vegetation[disk > 0].mean()) >= cfg.seed_vegetation_max:
        raise _PinNotOnRoof("The pin is on trees or grass, not a roof. Pin the middle of the roof.")

    smoothed = cv2.pyrMeanShiftFiltering(work, sp=int(max(4, round(cfg.meanshift_spatial_m / mpp))), sr=cfg.meanshift_colour)
    try:
        region, tolerance, may_be_cut = _adaptive_flood(smoothed, seed, mpp, cfg, vegetation if cfg.vegetation_filter else None)
    except _RoofAtMosaicEdge:
        if not allow_edge:
            raise
        raise RoofDetectionError("No roof surface found at the pin. Place the pin in the middle of the roof.")
    if may_be_cut and not allow_edge:
        raise _RoofAtMosaicEdge("The roof reaches the edge of the imagery.")

    background = vegetation | _shadow_mask(image, cfg)
    region = _grabcut_refine(work, region, seed, mpp, cfg, background)
    if vegetation.any():
        # Canopy can still slip in through GrabCut; trim it unless that removes most of the roof
        trimmed = _clean(region & (1 - vegetation), seed, mpp)
        if trimmed.sum() >= 0.6 * region.sum():
            region = trimmed

    short, _ = _rect_sides(region)
    if short * mpp < cfg.min_roof_width_m:
        raise RoofDetectionError("The detected surface is too narrow to be a roof. Re-pin nearer the roof centre.")
    if _road_like(region, mpp, cfg):
        raise _PinNotOnRoof("The pin looks like it is on a road or path, not a roof. Pin the middle of the roof.")

    points, rectangularity, outline = _outline(work, region, seed, mpp, background)
    area_m2 = _polygon_area(points) * mpp ** 2
    if area_m2 < cfg.min_roof_m2:
        raise RoofDetectionError("The detected surface is too small to be a roof. Re-pin nearer the roof centre.")
    if area_m2 > cfg.max_roof_m2 * 1.25:
        raise RoofDetectionError("The detected surface is larger than a single roof. Re-pin on the roof or enter the area.")

    polygon: List[List[float]] = []
    for x, y in points:
        lat, lon = _world_to_latlon(origin_x + float(x), origin_y + float(y), zoom)
        polygon.append([round(lat, 7), round(lon, 7)])

    # Confidence: compact, rectangular, plausibly sized regions that grew stably
    perimeter = cv2.arcLength(points.reshape(-1, 1, 2), True)
    compactness = 4 * math.pi * _polygon_area(points) / perimeter ** 2 if perimeter > 0 else 0
    size_score = 1.0 if 30 <= area_m2 <= 2500 else 0.6
    confidence = round(max(0.05, min(0.98, 0.45 * rectangularity + 0.30 * min(1, compactness / 0.7) + 0.25 * size_score)), 2)
    if confidence < cfg.min_confidence:
        raise RoofDetectionError("The roof outline is too uncertain. Re-pin or enter the area manually.")

    tiles = h // TILE_SIZE
    return {
        "polygon": polygon,
        "area_m2": round(area_m2, 1),
        "confidence": confidence,
        "zoom": zoom,
        "metres_per_pixel": round(mpp, 4),
        "rectangularity": round(rectangularity, 2),
        "colour_tolerance": tolerance,
        "outline": outline,
        "preprocessing": preprocessing,
        "mosaic_tiles": f"{tiles}x{tiles}",
        "method": "mean-shift + adaptive flood fill + GrabCut (vegetation/shadow aware) + orthogonal edge-snapped outline",
        "imagery": "Esri World Imagery",
    }
