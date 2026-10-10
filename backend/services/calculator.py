"""
Rooftop rainwater harvesting (RTRWH) assessment engine.

Every public number in an assessment comes from `RTRWHCalculator.assess`, so the
API, the PDF/TXT reports and the frontend all agree. Design follows CGWB's
"Manual on Artificial Recharge of Ground Water" and IS 15797:2008 (Roof Top
Rainwater Harvesting - Guidelines) practice; unit rates are indicative 2025
Indian market rates inclusive of GST.
"""
import logging
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from services.financials import build_financial_statement
from services.dossiers import build_dossiers, score_options
from services.subsidies import find_subsidies

logger = logging.getLogger(__name__)

# Runoff coefficients (IS 15797 / CGWB manual)
ROOF_COEFFICIENTS = {"concrete": 0.80, "tile": 0.75, "metal": 0.90, "asbestos": 0.80, "thatched": 0.55}
# Maintenance factor applied on top of the runoff coefficient
CONDITION_FACTORS = {"good": 1.0, "fair": 0.90, "poor": 0.75}
# Saturated infiltration rates, mm/hr (NRCS hydrologic soil groups, Indian field values)
SOIL_INFILTRATION = {"sandy": 30.0, "loamy": 13.0, "clay": 2.5, "rocky": 1.0}
SOIL_LABELS = {"sandy": "sandy", "loamy": "loamy", "clay": "clayey", "rocky": "rocky / hard-rock"}

# All-India mean monthly share of annual rainfall (IMD normals), used when no
# location-specific monthly series is supplied
DEFAULT_MONTHLY_SHARE = [0.015, 0.018, 0.025, 0.035, 0.055, 0.145, 0.240, 0.220, 0.145, 0.065, 0.025, 0.012]
MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

FIRST_FLUSH_MM = 1.5          # diverted per rain event (IS 15797 recommends 1-2 mm)
DESIGN_STORM_MM_PER_HR = 40   # peak hourly intensity the recharge structure must absorb
PIT_DEPTH = 2.5
PIT_MAX_DIAMETER = 2.0
PIT_POROSITY = 0.40           # boulder/gravel/sand filled
TRENCH_WIDTH = 0.8
TRENCH_DEPTH = 1.5
TRENCH_MAX_LENGTH = 15.0
TRENCH_POROSITY = 0.35
MAX_RESIDENTIAL_TANK_M3 = 100.0
MIN_RECHARGE_RATE = 2.0       # mm/hr below which recharge is not advised

VALID_CODES = ("storage_only", "recharge_only", "hybrid", "storage_priority_hybrid", "not_feasible")


def _num(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class SiteInputs:
    roof_area: float
    annual_rainfall: float
    roof_material: str
    roof_condition: str
    soil_type: str
    water_demand: float            # litres per day
    water_tariff: float            # ₹ per m³
    monthly_rainfall: List[float]  # mm, 12 values summing to annual_rainfall
    first_flush_mm: float = FIRST_FLUSH_MM
    state: str = ""
    district: str = ""
    city: str = ""


class RTRWHCalculator:
    """Sizing, recommendation and costing for one site."""

    # ---------- inputs ----------
    def normalise(self, site: Dict[str, Any], default_tariff: float) -> SiteInputs:
        material = str(site.get("roof_material") or "concrete").strip().lower()
        condition = str(site.get("roof_condition") or "good").strip().lower()
        soil = str(site.get("soil_type") or "loamy").strip().lower()
        annual = max(0.0, _num(site.get("annual_rainfall")))
        tariff = _num(site.get("water_tariff"), default_tariff)

        monthly_raw = site.get("monthly_rainfall") or []
        monthly = [max(0.0, _num(v)) for v in monthly_raw][:12] if len(monthly_raw) >= 12 else []
        if monthly and sum(monthly) > 0:
            # Keep the monthly shape but make it agree with the annual figure used
            scale = annual / sum(monthly) if annual > 0 else 1.0
            monthly = [v * scale for v in monthly]
            if annual <= 0:
                annual = sum(monthly)
        else:
            monthly = [annual * share for share in DEFAULT_MONTHLY_SHARE]

        return SiteInputs(
            roof_area=_clamp(_num(site.get("roof_area")), 0.0, 100_000.0),
            annual_rainfall=annual,
            roof_material=material if material in ROOF_COEFFICIENTS else "concrete",
            roof_condition=condition if condition in CONDITION_FACTORS else "fair",
            soil_type=soil if soil in SOIL_INFILTRATION else "loamy",
            water_demand=max(0.0, _num(site.get("water_demand"))),
            water_tariff=tariff if tariff > 0 else default_tariff,
            monthly_rainfall=monthly,
            # Settings allow 1.0-2.5 mm; IS 15797 recommends 1-2 mm
            first_flush_mm=_clamp(_num(site.get("first_flush_mm"), FIRST_FLUSH_MM) or FIRST_FLUSH_MM, 0.5, 3.0),
            state=str(site.get("state") or ""),
            district=str(site.get("district") or ""),
            city=str(site.get("city") or ""),
        )

    # ---------- hydrology ----------
    @staticmethod
    def rain_events(annual_rainfall: float) -> int:
        """Approximate rain events per year (≈ one per 25 mm), for first-flush losses."""
        return int(_clamp(round(annual_rainfall / 25), 0 if annual_rainfall <= 0 else 6, 80))

    def harvest(self, s: SiteInputs) -> Dict[str, Any]:
        coefficient = ROOF_COEFFICIENTS[s.roof_material]
        condition = CONDITION_FACTORS[s.roof_condition]
        effective = coefficient * condition
        gross = s.roof_area * s.annual_rainfall / 1000
        runoff = gross * effective
        events = self.rain_events(s.annual_rainfall)
        first_flush = min(runoff, s.roof_area * s.first_flush_mm / 1000 * events)
        harvestable = max(0.0, runoff - first_flush)

        # Monthly harvest keeps the annual total exact
        monthly = [harvestable * (m / s.annual_rainfall) if s.annual_rainfall > 0 else 0.0 for m in s.monthly_rainfall]
        return {
            "gross_rainfall_volume": gross,
            "runoff_coefficient": coefficient,
            "condition_factor": condition,
            "effective_coefficient": effective,
            "rain_events": events,
            "first_flush_loss": first_flush,
            "harvestable_volume": harvestable,
            "monthly_harvest": monthly,
        }

    @staticmethod
    def _simulate(capacity: float, monthly_inflow: Sequence[float], monthly_demand: Sequence[float]) -> Dict[str, float]:
        """Monthly tank mass balance; the second year is reported so the start level doesn't matter."""
        level, supplied, overflow = capacity / 2, 0.0, 0.0
        for year in range(2):
            supplied, overflow = 0.0, 0.0
            for inflow, demand in zip(monthly_inflow, monthly_demand):
                level += inflow
                if level > capacity:
                    overflow += level - capacity
                    level = capacity
                use = min(level, demand)
                level -= use
                supplied += use
        return {"supplied": supplied, "overflow": overflow}

    def size_storage(self, s: SiteInputs, monthly_harvest: List[float]) -> Dict[str, Any]:
        annual_demand = s.water_demand * 365 / 1000
        harvestable = sum(monthly_harvest)
        if annual_demand <= 0 or harvestable <= 0:
            return {
                "required_volume": 0.0, "recommended_volume": 0.0, "storage_days": 0,
                "annual_supply": 0.0, "demand_coverage": 0.0, "annual_demand": annual_demand,
                "overflow_to_recharge": harvestable,
            }

        monthly_demand = [s.water_demand * days / 1000 for days in MONTH_DAYS]
        ceiling = min(MAX_RESIDENTIAL_TANK_M3, max(harvestable, 1.0))
        best = self._simulate(ceiling, monthly_harvest, monthly_demand)["supplied"]

        # Grow the tank in 0.5 m³ steps while the extra capacity still earns its keep:
        # stop at 90% of what an unlimited tank could supply, or once another
        # 0.5 m³ adds less than 2 m³/year (each m³ of tank should cycle ≥ 4 times a year)
        required = 0.5
        supplied = self._simulate(required, monthly_harvest, monthly_demand)["supplied"]
        while required < ceiling and supplied < 0.9 * best:
            gain = self._simulate(required + 0.5, monthly_harvest, monthly_demand)["supplied"] - supplied
            if gain < 2.0:
                break
            required += 0.5
            supplied += gain

        # Round up to a standard tank size
        standard = [1, 1.5, 2, 3, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100]
        recommended = next((size for size in standard if size >= required), math.ceil(required))
        run = self._simulate(recommended, monthly_harvest, monthly_demand)
        return {
            "required_volume": round(required, 2),
            "recommended_volume": float(recommended),
            "storage_days": int(round(recommended * 1000 / s.water_demand)) if s.water_demand > 0 else 0,
            "annual_supply": run["supplied"],
            "demand_coverage": run["supplied"] / annual_demand if annual_demand > 0 else 0.0,
            "annual_demand": annual_demand,
            "overflow_to_recharge": run["overflow"],
        }

    def size_recharge(self, s: SiteInputs, effective_coefficient: float) -> Dict[str, Any]:
        rate_mm_hr = SOIL_INFILTRATION[s.soil_type]
        k = rate_mm_hr / 1000  # m/hr
        # Runoff from one hour of design-storm rain must be held + infiltrated within that hour
        design_runoff = s.roof_area * DESIGN_STORM_MM_PER_HR / 1000 * effective_coefficient

        # Recharge pit: storage in voids + infiltration through base and sides
        def pit_capacity(diameter: float) -> float:
            area = math.pi * diameter ** 2 / 4
            wetted = area + math.pi * diameter * PIT_DEPTH
            return area * PIT_DEPTH * PIT_POROSITY + wetted * k

        per_pit = pit_capacity(PIT_MAX_DIAMETER)
        pit_count = max(1, math.ceil(design_runoff / per_pit)) if design_runoff > 0 else 0
        load = design_runoff / pit_count if pit_count else 0
        diameter = PIT_MAX_DIAMETER
        if pit_count == 1:
            diameter = 1.0
            while diameter < PIT_MAX_DIAMETER and pit_capacity(diameter) < load:
                diameter = round(diameter + 0.1, 2)
        pit_area = math.pi * diameter ** 2 / 4

        # Recharge trench alternative
        per_metre = TRENCH_WIDTH * TRENCH_DEPTH * TRENCH_POROSITY + (TRENCH_WIDTH + 2 * TRENCH_DEPTH) * k
        total_length = design_runoff / per_metre if design_runoff > 0 else 0
        trench_count = max(1, math.ceil(total_length / TRENCH_MAX_LENGTH)) if total_length > 0 else 0
        trench_length = math.ceil(total_length / trench_count * 2) / 2 if trench_count else 0
        trench_length = max(trench_length, 2.0) if trench_count else 0

        # Annual recharge capacity is limited by soil, not by the structure volume
        suitability = _clamp(rate_mm_hr / 30 * 10, 0, 10)
        return {
            "recharge_pit": {"diameter": round(diameter, 2), "depth": PIT_DEPTH, "area": round(pit_area, 2), "count": pit_count},
            "recharge_trench": {"length": round(trench_length, 2), "width": TRENCH_WIDTH, "depth": TRENCH_DEPTH, "count": trench_count},
            "infiltration_rate": rate_mm_hr,
            "design_runoff": round(design_runoff, 2),
            "suitability_score": round(suitability, 1),
            "recharge_feasible": rate_mm_hr >= MIN_RECHARGE_RATE,
        }

    # ---------- decision ----------
    @staticmethod
    def recommend(scores: Dict[str, int], harvestable: float, surplus_share: float) -> Dict[str, Any]:
        """Pick the best-scoring option; returns the API code and the recharge structure to cost."""
        best = max(scores, key=lambda key: (scores[key], key == "hybrid"))
        if harvestable < 1.0 or scores[best] < 30:
            return {"code": "not_feasible", "recharge_kind": None, "best": best}
        if best == "storage":
            return {"code": "storage_only", "recharge_kind": None, "best": best}
        kind = "trench" if scores["recharge_trench"] > scores["recharge_pit"] else "pit"
        if best == "hybrid":
            return {"code": "hybrid" if surplus_share >= 0.35 else "storage_priority_hybrid", "recharge_kind": kind, "best": best}
        return {"code": "recharge_only", "recharge_kind": "trench" if best == "recharge_trench" else "pit", "best": best}

    # ---------- safety ----------
    @staticmethod
    def safety_checks(s: SiteInputs, storage: Dict[str, Any], recharge: Dict[str, Any]) -> List[str]:
        warnings = []
        if s.roof_material == "asbestos":
            warnings.append("CRITICAL: Asbestos roof detected. Do not use harvested water for drinking or cooking; route it to recharge or non-potable uses only.")
        if s.roof_material == "thatched":
            warnings.append("WARNING: Thatched roofs leach organic matter. Provide a sand-charcoal filter and use the water for non-potable purposes.")
        if s.roof_condition == "poor":
            warnings.append("WARNING: Poor roof condition lowers yield by about 25%. Repair cracks and clean the catchment before installation.")
        if s.soil_type == "clay" and s.annual_rainfall > 1200:
            warnings.append("WARNING: Clay soil with heavy rainfall may cause waterlogging around recharge structures; provide an overflow to the storm drain.")
        if not recharge["recharge_feasible"]:
            warnings.append("WARNING: Soil infiltration is too low for effective recharge. Prioritise storage or consult a hydrogeologist about a recharge well.")
        if storage["recommended_volume"] > 15:
            warnings.append("WARNING: Tanks above 15 m³ need a structural design check, a lockable manhole and UV-stable construction.")
        if s.annual_rainfall < 400:
            warnings.append("WARNING: Low annual rainfall; expect long dry spells and size demand expectations accordingly.")
        warnings.extend([
            "REQUIRED: Keep recharge pits at least 6 m from septic tanks, soak pits and building foundations.",
            "REQUIRED: Install a first-flush diverter to discard the first, most contaminated runoff of every rain event.",
            "REQUIRED: Provide an overflow from the tank and recharge structure to the storm drain.",
            "RECOMMENDED: Test stored water for pH, turbidity and coliform bacteria before potable use.",
            "RECOMMENDED: Use opaque, covered tanks with mosquito-proof mesh on every opening.",
            "RECOMMENDED: Clean gutters, leaf screens and filters before and twice during the monsoon.",
        ])
        return warnings

    # ---------- full assessment ----------
    def assess(self, site: Dict[str, Any], default_tariff: float = 50.0) -> Dict[str, Any]:
        s = self.normalise(site, default_tariff)
        h = self.harvest(s)
        harvestable = h["harvestable_volume"]
        storage = self.size_storage(s, h["monthly_harvest"])
        recharge = self.size_recharge(s, h["effective_coefficient"])
        surplus_share = storage["overflow_to_recharge"] / harvestable if harvestable > 0 else 0.0
        scores = score_options(s, h, storage, recharge)
        decision = self.recommend(scores, harvestable, surplus_share)
        recommendation = decision["code"]

        uses_storage = recommendation in ("storage_only", "hybrid", "storage_priority_hybrid")
        uses_recharge = recommendation in ("recharge_only", "hybrid", "storage_priority_hybrid")

        # Water actually used from the tank, and water sent to the aquifer
        supplied = storage["annual_supply"] if uses_storage else 0.0
        if uses_recharge:
            recharged = storage["overflow_to_recharge"] if uses_storage else harvestable
        else:
            recharged = 0.0

        statement = build_financial_statement(
            recommendation=recommendation,
            roof_area=s.roof_area,
            storage=storage,
            recharge=recharge,
            prefer_trench=decision["recharge_kind"] == "trench",
        )
        # Savings count all the rainwater the site can put to use: the whole
        # harvest, up to its annual demand. A site that uses more water than
        # its roof collects uses every litre, so savings never drop to zero
        # just because demand is large.
        annual_demand = s.water_demand * 365 / 1000
        water_used = min(harvestable, annual_demand) if (uses_storage or annual_demand > 0) and recommendation != "not_feasible" else 0.0
        annual_savings = water_used * s.water_tariff
        total = statement["total_cost"]
        payback_years = total / annual_savings if annual_savings > 0 else None

        subsidies = find_subsidies(s.state, total, s.water_tariff, water_used)

        storage_req = {
            "required_volume": storage["required_volume"],
            "recommended_volume": storage["recommended_volume"],
            "storage_days": storage["storage_days"],
            "annual_supply": round(storage["annual_supply"], 2),
            "demand_coverage": round(storage["demand_coverage"], 3),
            "annual_demand": round(storage["annual_demand"], 2),
        }
        context = {
            "inputs": s,
            "hydrology": h,
            "storage": storage,
            "recharge": recharge,
            "recommendation": recommendation,
            "recommended_dossier": decision["best"] if recommendation != "not_feasible" else None,
            "recharge_kind": decision["recharge_kind"],
            "scores": scores,
            "supplied": supplied,
            "recharged": recharged,
            "annual_savings": annual_savings,
            "statement": statement,
            "soil_label": SOIL_LABELS[s.soil_type],
        }

        return {
            "harvestable_volume": round(harvestable, 2),
            "recommended_option": recommendation,
            "storage_recommendation": storage_req,
            "recharge_recommendation": recharge,
            "cost_analysis": statement["legacy_cost_analysis"],
            "savings_analysis": {
                "annual_water_saved": round(water_used, 2),
                "annual_recharge": round(recharged, 2),
                "annual_cost_savings": round(annual_savings, 2),
                "monthly_savings": round(annual_savings / 12, 2),
                "water_tariff_used": s.water_tariff,
            },
            "safety_checks": self.safety_checks(s, storage, recharge),
            "bill_of_quantities": {
                "items": [
                    {"item": row["description"], "quantity": f"{row['quantity']:g} {row['unit']}", "rate": row["unit_price"], "amount": row["amount"]}
                    for row in statement["materials"] + statement["additional"]
                ],
                "total_cost": round(statement["materials_subtotal"] + statement["additional_subtotal"], 2),
            },
            "payback_period": f"{payback_years:.1f}" if payback_years is not None else "N/A",
            "financial_statement": statement,
            "subsidies": subsidies,
            "dossiers": build_dossiers(context),
            "hydrology": {
                "annual_rainfall": round(s.annual_rainfall, 1),
                "monthly_rainfall": [round(v, 1) for v in s.monthly_rainfall],
                "monthly_harvest": [round(v, 3) for v in h["monthly_harvest"]],
                "runoff_coefficient": h["runoff_coefficient"],
                "condition_factor": h["condition_factor"],
                "first_flush_loss": round(h["first_flush_loss"], 2),
                "first_flush_mm": s.first_flush_mm,
                "rain_events": h["rain_events"],
                "gross_rainfall_volume": round(h["gross_rainfall_volume"], 2),
                "infiltration_rate": recharge["infiltration_rate"],
            },
        }
