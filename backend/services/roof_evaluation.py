"""
Evaluate pin-to-roof detection (services/roof_detection.py).

Two data sources:

  Labelled cases (real imagery, needs internet for Esri tiles):
      python -m services.roof_evaluation --cases my_cases.json

  Built-in synthetic scenes (offline, deterministic; a regression check, not
  a measure of real-world accuracy):
      python -m services.roof_evaluation --synthetic

Cases file format (polygon = traced ground-truth roof as [lat, lon] pairs;
null means "no roof at this pin", e.g. a pin on a tree or a road; area_m2 may
replace polygon when only the measured area is known):

  {"cases": [
    {"name": "house A", "latitude": 22.57, "longitude": 88.36, "polygon": [[22.5701, 88.3601], ...]},
    {"name": "pin on tree", "latitude": 22.58, "longitude": 88.37, "polygon": null},
    {"name": "school", "latitude": 22.59, "longitude": 88.38, "area_m2": 640}
  ]}

Matching: a detection is a true positive when its IoU with the ground truth
is at least --iou (default 0.5), or, for area-only cases, when its area is
within --area-tolerance (default 25%). A detection on a no-roof case is a
false positive; a wrong outline counts as both a false positive and a false
negative, as in standard detection matching.

Settings can be changed per run with --set field=value (any field of
RoofDetectionConfig), and another version of the detector can be compared
with --module path/to/roof_detection.py.
"""
import argparse
import importlib.util
import json
import math
import statistics
import sys
import time
from dataclasses import dataclass, field
from types import ModuleType
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np

from services import roof_detection

EARTH_RADIUS = 6_371_008.8
LatLon = Tuple[float, float]


# ---------- geometry ----------

def _to_metres(polygon: List[LatLon], lat0: float, lon0: float) -> np.ndarray:
    k = math.cos(math.radians(lat0))
    return np.array([[math.radians(lon - lon0) * EARTH_RADIUS * k, -math.radians(lat - lat0) * EARTH_RADIUS]
                     for lat, lon in polygon], np.float64)


def polygon_area_m2(polygon: List[LatLon]) -> float:
    if len(polygon) < 3:
        return 0.0
    lat0 = sum(p[0] for p in polygon) / len(polygon)
    lon0 = sum(p[1] for p in polygon) / len(polygon)
    xy = _to_metres(polygon, lat0, lon0)
    x, y = xy[:, 0], xy[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def polygon_iou(a: List[LatLon], b: List[LatLon], resolution_m: float = 0.1) -> float:
    """IoU of two lat/lon polygons, rasterised on a local metric grid."""
    points = list(a) + list(b)
    lat0 = sum(p[0] for p in points) / len(points)
    lon0 = sum(p[1] for p in points) / len(points)
    pa, pb = _to_metres(a, lat0, lon0), _to_metres(b, lat0, lon0)
    lo = np.minimum(pa.min(axis=0), pb.min(axis=0)) - 1
    hi = np.maximum(pa.max(axis=0), pb.max(axis=0)) + 1
    w, h = (np.ceil((hi - lo) / resolution_m).astype(int) + 1)
    if w * h > 40_000_000:  # keep the raster bounded for very large polygons
        resolution_m *= math.sqrt(w * h / 40_000_000)
        w, h = (np.ceil((hi - lo) / resolution_m).astype(int) + 1)
    masks = []
    for poly in (pa, pb):
        mask = np.zeros((h, w), np.uint8)
        cv2.fillPoly(mask, [np.round((poly - lo) / resolution_m).astype(np.int32)], 1)
        masks.append(mask.astype(bool))
    union = np.logical_or(*masks).sum()
    return float(np.logical_and(*masks).sum() / union) if union else 0.0


# ---------- evaluation ----------

@dataclass
class CaseResult:
    name: str
    has_roof: bool
    detected: bool
    iou: Optional[float] = None
    true_area_m2: Optional[float] = None
    detected_area_m2: Optional[float] = None
    area_error: Optional[float] = None  # signed, relative to the true area
    correct: bool = False
    seconds: float = 0.0
    detail: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)


def evaluate_case(case: Dict[str, Any], detect: Callable[[float, float], Dict[str, Any]],
                  iou_threshold: float, area_tolerance: float) -> CaseResult:
    truth = case.get("polygon")
    true_area = polygon_area_m2(truth) if truth else case.get("area_m2")
    has_roof = bool(truth) or bool(true_area)
    result = CaseResult(name=case.get("name", f"{case['latitude']},{case['longitude']}"),
                        has_roof=has_roof, detected=False, true_area_m2=true_area)
    start = time.perf_counter()
    try:
        found = detect(case["latitude"], case["longitude"])
    except Exception as e:  # RoofDetectionError, or anything the detector raises
        result.seconds = time.perf_counter() - start
        result.detail = f"{type(e).__name__}: {e}"
        result.correct = not has_roof
        return result
    result.seconds = time.perf_counter() - start
    result.detected = True
    polygon = [tuple(p) for p in found["polygon"]]
    result.detected_area_m2 = polygon_area_m2(polygon)
    result.extra = {k: found[k] for k in ("confidence", "zoom", "outline", "preprocessing", "mosaic_tiles") if k in found}
    if not has_roof:
        result.detail = "detected a roof where there is none"
        return result
    result.area_error = (result.detected_area_m2 - true_area) / true_area
    if truth:
        result.iou = polygon_iou(polygon, [tuple(p) for p in truth])
        result.correct = result.iou >= iou_threshold
    else:
        result.correct = abs(result.area_error) <= area_tolerance
    return result


def summarise(results: List[CaseResult]) -> Dict[str, Any]:
    tp = sum(r.detected and r.has_roof and r.correct for r in results)
    fp = sum(r.detected and not r.correct for r in results)
    fn = sum(r.has_roof and not r.correct for r in results)
    tn = sum(not r.has_roof and not r.detected for r in results)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision and recall else None
    ious = [r.iou for r in results if r.iou is not None]
    errors = [abs(r.area_error) for r in results if r.area_error is not None]
    return {
        "cases": len(results), "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": precision, "recall": recall, "f1": f1,
        "mean_iou": statistics.mean(ious) if ious else None,
        "median_abs_area_error": statistics.median(errors) if errors else None,
        "mean_abs_area_error": statistics.mean(errors) if errors else None,
        "mean_seconds": statistics.mean(r.seconds for r in results) if results else None,
    }


# ---------- synthetic scenes ----------
# Each scene is drawn in metres around the pin (x east, y south) on a large
# canvas at zoom 19, and served to the detector through a patched _mosaic, so
# the whole detect_roof path (zoom fallback, mosaic growth) is exercised.

SYN_LAT, SYN_LON, SYN_ZOOM = 22.5726, 88.3639, 19
CANVAS_PX = 2560


def _rect(x0: float, y0: float, x1: float, y1: float) -> List[Tuple[float, float]]:
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def _rotated_rect(w: float, h: float, degrees: float) -> List[Tuple[float, float]]:
    t = math.radians(degrees)
    return [(x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t))
            for x, y in _rect(-w / 2, -h / 2, w / 2, h / 2)]


CONCRETE = (168, 172, 174)
SCENES: List[Dict[str, Any]] = [
    {"name": "rectangle 14x10 m", "truth": _rect(-7, -5, 7, 5),
     "draw": [("roof", _rect(-7, -5, 7, 5), CONCRETE)]},
    {"name": "rotated 16x11 m at 25 deg", "truth": _rotated_rect(16, 11, 25),
     "draw": [("roof", _rotated_rect(16, 11, 25), CONCRETE)]},
    {"name": "L-shaped roof", "truth": [(-12, -6), (8, -6), (8, 2), (-2, 2), (-2, 10), (-12, 10)],
     "draw": [("roof", [(-12, -6), (8, -6), (8, 2), (-2, 2), (-2, 10), (-12, 10)], CONCRETE)]},
    {"name": "trees against two walls", "truth": _rect(-7, -5, 7, 5),
     "draw": [("roof", _rect(-7, -5, 7, 5), (120, 150, 132)),
              ("tree", (12.4, 0), 5.5), ("tree", (-2, -10.3), 5.4), ("tree", (5, -9.8), 4.9)]},
    {"name": "cast shadow on two sides", "truth": _rect(-6, -4.5, 6, 4.5),
     "draw": [("shadow", [(x + 2.5, y + 2.5) for x, y in _rect(-6, -4.5, 6, 4.5)]),
              ("roof", _rect(-6, -4.5, 6, 4.5), (88, 92, 96))]},
    {"name": "road along one wall", "truth": _rect(-7, -5, 7, 5),
     "draw": [("road", _rect(-300, 5, 300, 13), (152, 156, 158)), ("roof", _rect(-7, -5, 7, 5), CONCRETE)]},
    {"name": "green painted metal roof", "truth": _rect(-6, -4, 6, 4),
     "draw": [("roof", _rect(-6, -4, 6, 4), (78, 138, 84)), ("ribs", _rect(-6, -4, 6, 4))]},
    {"name": "hazy low-contrast imagery", "truth": _rect(-8, -6, 8, 6), "haze": True,
     "draw": [("roof", _rect(-8, -6, 8, 6), (150, 152, 150))]},
    {"name": "terraced neighbours", "truth": _rect(-6, -5, 6, 5),
     "draw": [("roof", _rect(-18.6, -5, -6.6, 5), (150, 160, 166)), ("roof", _rect(-6, -5, 6, 5), CONCRETE),
              ("roof", _rect(6.6, -5, 18.6, 5), (176, 168, 160))]},
    {"name": "large roof past the 3x3 mosaic", "truth": _rect(-78, -20, 12, 20), "tile_offset": 12,
     "draw": [("roof", _rect(-78, -20, 12, 20), CONCRETE)]},
    {"name": "no roof: pin on tree canopy", "truth": None,
     "draw": [("tree", (0, 0), 6.5), ("roof", _rect(20, 10, 34, 20), CONCRETE)]},
    {"name": "no roof: pin on a road", "truth": None,
     "draw": [("road", _rect(-300, -3.5, 300, 3.5), (150, 152, 154)), ("roof", _rect(-7, 8, 7, 18), CONCRETE)]},
]


def _render(scene: Dict[str, Any], mpp: float, rng: np.random.Generator) -> np.ndarray:
    size = CANVAS_PX
    centre = size / 2
    to_px = lambda pts: np.round([(centre + x / mpp, centre + y / mpp) for x, y in pts]).astype(np.int32)
    # Bare ground with large-scale patches
    low = cv2.resize(rng.normal(0, 14, (size // 64, size // 64, 3)), (size, size), interpolation=cv2.INTER_CUBIC)
    img = np.array((92, 124, 146), np.float32) + low + rng.normal(0, 9, (size, size, 3))

    def paint(mask: np.ndarray, colour, noise: float):
        img[mask > 0] = np.array(colour, np.float32) + rng.normal(0, noise, (int(mask.sum()), 3))

    for kind, *args in scene["draw"]:
        mask = np.zeros((size, size), np.uint8)
        if kind in ("roof", "road", "shadow"):
            cv2.fillPoly(mask, [to_px(args[0])], 1)
            colour = {"shadow": (40, 44, 48)}.get(kind, args[1] if len(args) > 1 else None)
            paint(mask, colour, {"roof": 5, "road": 6, "shadow": 4}[kind])
            if kind == "roof":
                cv2.polylines(img, [to_px(args[0])], True, [c * 0.82 for c in colour], 1)  # parapet line
        elif kind == "tree":
            (cx, cy), radius = args
            for _ in range(14):  # a canopy is a cluster of crowns
                ox, oy = rng.normal(0, radius / 3, 2)
                r = radius * rng.uniform(0.45, 0.7)
                if math.hypot(ox, oy) + r > radius:
                    continue
                cv2.circle(mask, (int(centre + (cx + ox) / mpp), int(centre + (cy + oy) / mpp)), int(r / mpp), 1, -1)
            cv2.circle(mask, (int(centre + cx / mpp), int(centre + cy / mpp)), int(radius * 0.55 / mpp), 1, -1)
            # Crowns: lit leaves and dark gaps about 0.5–1 m across, as in 0.3 m imagery
            blotch = cv2.GaussianBlur(rng.normal(0, 1, (size, size)).astype(np.float32), (0, 0), 1.2)
            blotch /= blotch.std()
            green = np.stack([46 + 16 * blotch, 98 + 30 * blotch, 58 + 18 * blotch], -1)
            img[mask > 0] = green[mask > 0] + rng.normal(0, 6, (int(mask.sum()), 3))
        elif kind == "ribs":
            pts = to_px(args[0])
            x0, y0 = pts.min(axis=0)
            x1, y1 = pts.max(axis=0)
            for x in range(x0, x1, max(2, int(0.9 / mpp))):
                img[y0:y1, x] *= 0.9
    if scene.get("haze"):
        img = 0.45 * img + 0.55 * 140  # washed-out imagery
    img = cv2.GaussianBlur(np.clip(img, 0, 255).astype(np.uint8), (0, 0), 0.8)
    return img


def synthetic_cases(module: ModuleType) -> Tuple[List[Dict[str, Any]], Callable[[], None]]:
    """Build cases and patch module._mosaic to serve the scenes; returns (cases, restore)."""
    mpp = module.metres_per_pixel(SYN_LAT, SYN_ZOOM)
    canvases: Dict[Tuple[float, float], Tuple[np.ndarray, float, float]] = {}
    cases = []
    for index, scene in enumerate(SCENES):
        # Pins sit far apart in world pixels so scenes never share tiles
        wx, wy = module._world_pixel(SYN_LAT, SYN_LON + index * 0.05, SYN_ZOOM)
        offset = scene.get("tile_offset", 128)
        wx = math.floor(wx / 256) * 256 + offset + 0.5
        wy = math.floor(wy / 256) * 256 + 128 + 0.5
        lat, lon = module._world_to_latlon(wx, wy, SYN_ZOOM)
        rng = np.random.default_rng(1000 + index)
        canvases[(round(lat, 9), round(lon, 9))] = (_render(scene, mpp, rng), wx, wy)
        truth = None
        if scene["truth"]:
            truth = [module._world_to_latlon(wx + x / mpp, wy + y / mpp, SYN_ZOOM) for x, y in scene["truth"]]
        cases.append({"name": scene["name"], "latitude": lat, "longitude": lon, "polygon": truth})

    original = module._mosaic

    def fake_mosaic(latitude: float, longitude: float, zoom: int, radius: int = 1):
        if zoom != SYN_ZOOM:
            raise module.RoofDetectionError("No high-resolution imagery here at this zoom.")
        canvas, wx, wy = canvases[(round(latitude, 9), round(longitude, 9))]
        tile_x, tile_y = int(wx // 256), int(wy // 256)
        origin_x, origin_y = (tile_x - radius) * 256, (tile_y - radius) * 256
        side = (2 * radius + 1) * 256
        cx0 = int(origin_x - (wx - CANVAS_PX / 2))
        cy0 = int(origin_y - (wy - CANVAS_PX / 2))
        return canvas[cy0:cy0 + side, cx0:cx0 + side].copy(), origin_x, origin_y

    module._mosaic = fake_mosaic
    return cases, lambda: setattr(module, "_mosaic", original)


# ---------- command line ----------

def _load_module(path: Optional[str]) -> ModuleType:
    if not path:
        return roof_detection
    spec = importlib.util.spec_from_file_location("roof_detection_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fmt(value: Optional[float], pct: bool = False) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%" if pct else f"{value:.3f}"


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--cases", help="JSON file of labelled cases")
    source.add_argument("--synthetic", action="store_true", help="run the built-in synthetic scenes (offline)")
    parser.add_argument("--set", action="append", default=[], metavar="FIELD=VALUE", help="override a RoofDetectionConfig field")
    parser.add_argument("--module", help="evaluate another roof_detection.py (e.g. an older version) instead")
    parser.add_argument("--iou", type=float, default=0.5, help="IoU needed for a match (default 0.5)")
    parser.add_argument("--area-tolerance", type=float, default=0.25, help="relative area error allowed for area-only cases")
    parser.add_argument("--json", help="write per-case results and the summary to this file")
    args = parser.parse_args(argv)

    module = _load_module(args.module)
    config = None
    if args.set:
        if not hasattr(module, "RoofDetectionConfig"):
            parser.error("--set needs a detector with RoofDetectionConfig")
        overrides = {}
        defaults = module.RoofDetectionConfig()
        for item in args.set:
            name, _, raw = item.partition("=")
            if not hasattr(defaults, name):
                parser.error(f"unknown setting: {name}")
            overrides[name] = module.parse_config_value(raw, getattr(defaults, name))
        config = module.config_with(module.RoofDetectionConfig(), **overrides)

    detect = (lambda lat, lon: module.detect_roof(lat, lon, config)) if config else module.detect_roof
    restore = lambda: None
    if args.synthetic:
        cases, restore = synthetic_cases(module)
    else:
        with open(args.cases, encoding="utf-8") as handle:
            data = json.load(handle)
        cases = data["cases"] if isinstance(data, dict) else data

    try:
        results = [evaluate_case(case, detect, args.iou, args.area_tolerance) for case in cases]
    finally:
        restore()
    summary = summarise(results)

    print(f"{'case':<34} {'ok':<3} {'IoU':>6} {'true m2':>9} {'found m2':>9} {'area err':>9}  detail")
    for r in results:
        print(f"{r.name[:34]:<34} {'yes' if r.correct else 'NO':<3} {_fmt(r.iou):>6} "
              f"{(f'{r.true_area_m2:.1f}' if r.true_area_m2 else '-'):>9} "
              f"{(f'{r.detected_area_m2:.1f}' if r.detected_area_m2 else '-'):>9} "
              f"{_fmt(r.area_error, True):>9}  {r.detail or r.extra}")
    print()
    print(f"precision {_fmt(summary['precision'])}  recall {_fmt(summary['recall'])}  F1 {_fmt(summary['f1'])}  "
          f"mean IoU {_fmt(summary['mean_iou'])}  median |area error| {_fmt(summary['median_abs_area_error'], True)}  "
          f"(TP {summary['tp']}, FP {summary['fp']}, FN {summary['fn']}, TN {summary['tn']}; "
          f"{summary['mean_seconds']:.2f} s/case)")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump({"summary": summary, "cases": [r.__dict__ for r in results]}, handle, indent=2, default=str)
    return 0


if __name__ == "__main__":
    sys.exit(main())
