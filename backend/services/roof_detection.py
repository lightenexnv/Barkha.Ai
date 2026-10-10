"""
Pin-to-roof detection.

Given the point a user pinned on the satellite map, fetch the surrounding
imagery, segment the roof that contains the pin and return its outline as a
lat/lon polygon together with its ground area in m².

Pipeline: Web-Mercator tile mosaic → mean-shift smoothing → seeded flood fill
with an adaptive colour tolerance (stops before the region leaks into the
surroundings) → GrabCut refinement → morphological clean-up → polygon
simplification (snapped to a rectangle when the roof is rectangular).
"""
import logging
import math
from concurrent.futures import ThreadPoolExecutor
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
MIN_ROOF_M2 = 12.0
MAX_ROOF_M2 = 6000.0
GRID_RADIUS = 1  # 3 × 3 tiles around the pin


class RoofDetectionError(Exception):
    pass


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


def _mosaic(latitude: float, longitude: float, zoom: int) -> Tuple[np.ndarray, int, int]:
    """3 × 3 tile mosaic around the point; returns BGR image and its world-pixel origin."""
    px, py = _world_pixel(latitude, longitude, zoom)
    tile_x, tile_y = int(px // TILE_SIZE), int(py // TILE_SIZE)
    coords = [(tile_x + dx, tile_y + dy) for dy in range(-GRID_RADIUS, GRID_RADIUS + 1) for dx in range(-GRID_RADIUS, GRID_RADIUS + 1)]
    with ThreadPoolExecutor(max_workers=9) as pool:
        tiles = list(pool.map(lambda c: _fetch_tile(zoom, c[0], c[1]), coords))
    if any(t is None for t in tiles):
        raise RoofDetectionError("Satellite imagery could not be downloaded for this location.")

    side = (2 * GRID_RADIUS + 1) * TILE_SIZE
    canvas = Image.new("RGB", (side, side))
    for (cx, cy), data in zip(coords, tiles):
        tile = Image.open(BytesIO(data)).convert("RGB")
        canvas.paste(tile, ((cx - tile_x + GRID_RADIUS) * TILE_SIZE, (cy - tile_y + GRID_RADIUS) * TILE_SIZE))
    image = cv2.cvtColor(np.array(canvas), cv2.COLOR_RGB2BGR)
    origin_x = (tile_x - GRID_RADIUS) * TILE_SIZE
    origin_y = (tile_y - GRID_RADIUS) * TILE_SIZE
    return image, origin_x, origin_y


def _is_placeholder(image: np.ndarray) -> bool:
    """Esri serves a flat grey 'map data not yet available' tile where it has no imagery."""
    centre = image[TILE_SIZE:2 * TILE_SIZE, TILE_SIZE:2 * TILE_SIZE]
    return float(centre.std()) < 6.0


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


def _adaptive_flood(smoothed: np.ndarray, seed: Tuple[int, int], mpp: float) -> Tuple[np.ndarray, int]:
    """Grow the region with rising tolerance and stop just before it leaks."""
    max_px = MAX_ROOF_M2 / mpp ** 2
    previous, previous_tol = None, 0
    for tolerance in (6, 9, 12, 15, 19, 24, 30):
        region = _clean(_flood(smoothed, seed, tolerance), seed, mpp)
        area = int(region.sum())
        leaked = (
            area > max_px
            or _touches_border(region)
            or (previous is not None and previous.sum() > 0 and area > 2.2 * previous.sum() and area * mpp ** 2 > 60)
        )
        if leaked:
            break
        previous, previous_tol = region, tolerance
    if previous is None or previous.sum() == 0:
        raise RoofDetectionError("No roof surface found at the pin. Place the pin in the middle of the roof.")
    return previous, previous_tol


def _grabcut_refine(image: np.ndarray, region: np.ndarray, seed: Tuple[int, int], mpp: float) -> np.ndarray:
    band = max(4, int(round(4 / mpp)))  # ≈ 4 m uncertain band around the flood region
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
    inner = cv2.erode(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (band, band)))
    outer = cv2.dilate(region, kernel)

    gc = np.full(region.shape, cv2.GC_BGD, np.uint8)
    gc[outer > 0] = cv2.GC_PR_BGD
    gc[region > 0] = cv2.GC_PR_FGD
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
        cv2.grabCut(image[y0:y1, x0:x1], crop_mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    except cv2.error as e:
        logger.info(f"GrabCut skipped: {e}")
        return region
    refined = np.zeros_like(region)
    refined[y0:y1, x0:x1] = ((crop_mask == cv2.GC_FGD) | (crop_mask == cv2.GC_PR_FGD)).astype(np.uint8)
    refined = _clean(refined, seed, mpp)
    ratio = refined.sum() / max(1, region.sum())
    # Accept the refinement only if it stays close to the flood estimate
    return refined if 0.6 <= ratio <= 1.6 and not _touches_border(refined) else region


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


def detect_roof(latitude: float, longitude: float) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for zoom in (19, 18):
        try:
            image, origin_x, origin_y = _mosaic(latitude, longitude, zoom)
        except RoofDetectionError as e:
            last_error = e
            continue
        if _is_placeholder(image):
            last_error = RoofDetectionError("No high-resolution imagery here at this zoom.")
            continue
        try:
            return _detect_in_image(image, origin_x, origin_y, latitude, longitude, zoom)
        except RoofDetectionError as e:
            last_error = e
            continue
    raise last_error or RoofDetectionError("Roof detection failed.")


def _detect_in_image(image: np.ndarray, origin_x: int, origin_y: int, latitude: float, longitude: float, zoom: int) -> Dict[str, Any]:
    mpp = metres_per_pixel(latitude, zoom)
    wx, wy = _world_pixel(latitude, longitude, zoom)
    seed = (int(round(wx - origin_x)), int(round(wy - origin_y)))

    smoothed = cv2.pyrMeanShiftFiltering(image, sp=int(max(4, round(2 / mpp))), sr=20)
    region, tolerance = _adaptive_flood(smoothed, seed, mpp)
    region = _grabcut_refine(image, region, seed, mpp)

    points, rectangularity = _polygon(region)
    area_m2 = _polygon_area(points) * mpp ** 2
    if area_m2 < MIN_ROOF_M2:
        raise RoofDetectionError("The detected surface is too small to be a roof. Re-pin nearer the roof centre.")

    polygon: List[List[float]] = []
    for x, y in points:
        lat, lon = _world_to_latlon(origin_x + float(x), origin_y + float(y), zoom)
        polygon.append([round(lat, 7), round(lon, 7)])

    # Confidence: compact, rectangular, plausibly sized regions that grew stably
    perimeter = cv2.arcLength(points.reshape(-1, 1, 2), True)
    compactness = 4 * math.pi * _polygon_area(points) / perimeter ** 2 if perimeter > 0 else 0
    size_score = 1.0 if 30 <= area_m2 <= 2500 else 0.6
    confidence = round(max(0.05, min(0.98, 0.45 * rectangularity + 0.30 * min(1, compactness / 0.7) + 0.25 * size_score)), 2)

    return {
        "polygon": polygon,
        "area_m2": round(area_m2, 1),
        "confidence": confidence,
        "zoom": zoom,
        "metres_per_pixel": round(mpp, 4),
        "rectangularity": round(rectangularity, 2),
        "colour_tolerance": tolerance,
        "method": "mean-shift + adaptive flood fill + GrabCut",
        "imagery": "Esri World Imagery",
    }
