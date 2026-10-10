"""
Engineering dossiers: one per candidate system (storage tank, recharge pit,
recharge trench, hybrid), each sized, costed, justified and scored for the site.
"""
from typing import Any, Dict, List

from services.financials import build_financial_statement

# Share of water routed to a recharge structure that reaches the aquifer
RECHARGE_EFFICIENCY = {"sandy": 0.90, "loamy": 0.80, "clay": 0.50, "rocky": 0.40}



def score_options(s, h: Dict[str, Any], storage: Dict[str, Any], recharge: Dict[str, Any]) -> Dict[str, int]:
    """0-100 match score for each candidate system on this site."""
    demand = storage["annual_demand"]
    harvestable = h["harvestable_volume"]
    coverage = storage["demand_coverage"]
    supply_value = min(1.0, coverage / 0.6)                     # covering 60%+ of demand earns full marks
    soil_value = min(1.0, recharge["infiltration_rate"] / 15)  # loamy-or-better soils earn full marks
    surplus_share = storage["overflow_to_recharge"] / harvestable if harvestable > 0 else 0.0
    has_demand = demand > 0
    feasible = recharge["recharge_feasible"]
    pit, trench = recharge["recharge_pit"], recharge["recharge_trench"]

    if has_demand and storage["recommended_volume"] > 0:
        storage_score = 20 + 55 * supply_value + 15 * h["effective_coefficient"] + (10 if storage["recommended_volume"] <= 10 else 5)
        if s.roof_material == "asbestos":
            storage_score -= 25
    else:
        storage_score = 10

    # Recharge alone serves no household demand, so it ranks lower where demand exists
    no_demand_bonus = 25 if not has_demand else -5
    pit_score = 15 + 45 * soil_value + (15 if pit["count"] <= 2 else 5) + no_demand_bonus
    trench_fit = s.soil_type in ("clay", "rocky") or s.roof_area > 300
    trench_score = 15 + 40 * soil_value + (15 if trench_fit else 5) + (8 if trench["count"] <= 2 else 2) + no_demand_bonus
    if not feasible:
        pit_score, trench_score = min(pit_score, 25), min(trench_score, 28)

    if has_demand and feasible and storage["recommended_volume"] > 0:
        hybrid_score = 20 + 35 * supply_value + 30 * soil_value * min(1.0, surplus_share / 0.3) + 15 * h["effective_coefficient"]
        if s.roof_material == "asbestos":
            hybrid_score -= 10
    else:
        hybrid_score = 20

    scores = {
        "storage": storage_score,
        "recharge_pit": pit_score,
        "recharge_trench": trench_score,
        "hybrid": hybrid_score,
    }
    if harvestable < 1.0:
        # Too little runoff for any structure to be worthwhile
        scores = {key: min(value, 15) for key, value in scores.items()}
    return {key: _clamp(value) for key, value in scores.items()}



def _pct(value: float) -> str:
    return f"{round(value * 100):d}%"


def _litres(m3: float) -> str:
    return f"{round(m3 * 1000):,} L"


def _clamp(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _rating(score: int) -> str:
    if score >= 80:
        return "Excellent match"
    if score >= 60:
        return "Good match"
    if score >= 40:
        return "Moderate match"
    return "Poor match"


def _financial(statement: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "materials_subtotal": statement["materials_subtotal"],
        "additional_subtotal": statement["additional_subtotal"],
        "contingency": statement["contingency"],
        "total_cost": statement["total_cost"],
        "breakdown": [
            {"label": row["description"], "amount": row["amount"]}
            for row in sorted(statement["materials"] + statement["additional"], key=lambda r: -r["amount"])[:6]
        ],
    }


def _benefits(supplied: float, recharged: float, tariff: float) -> Dict[str, Any]:
    return {
        "annual_litres_saved": round(supplied * 1000),
        "annual_recharge_litres": round(recharged * 1000),
        "annual_bill_savings": round(supplied * tariff, 2),
        "summary": [
            f"{_litres(supplied)} of municipal / tanker water replaced every year" if supplied > 0 else "No direct replacement of bought water",
            f"{_litres(recharged)} returned to the aquifer every year" if recharged > 0 else "No groundwater recharge",
            f"About ₹{round(supplied * tariff):,} saved on water bills each year" if supplied > 0 else "Benefit is groundwater security rather than bill savings",
        ],
    }


def build_dossiers(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    s = ctx["inputs"]
    h = ctx["hydrology"]
    storage = ctx["storage"]
    recharge = ctx["recharge"]
    recommendation = ctx["recommendation"]
    harvestable = h["harvestable_volume"]
    soil = ctx["soil_label"]
    rate = recharge["infiltration_rate"]
    efficiency = RECHARGE_EFFICIENCY.get(s.soil_type, 0.6)
    demand = storage["annual_demand"]
    coverage = storage["demand_coverage"]
    surplus = storage["overflow_to_recharge"]
    pit = recharge["recharge_pit"]
    trench = recharge["recharge_trench"]
    tariff = s.water_tariff
    tank = storage["recommended_volume"]

    recommended_id = ctx["recommended_dossier"]
    scores = ctx["scores"]
    hybrid_trench = ctx["recharge_kind"] == "trench" if ctx["recharge_kind"] else scores["recharge_trench"] > scores["recharge_pit"]

    site_line = (
        f"Your {s.roof_area:,.0f} m² {s.roof_material} roof in {s.roof_condition} condition receives "
        f"{s.annual_rainfall:,.0f} mm of rain a year and can yield about {harvestable:,.1f} m³ ({_litres(harvestable)})."
    )
    soil_line = f"The {soil} soil infiltrates about {rate:g} mm/hr."
    demand_line = (
        f"Household demand is {s.water_demand:,.0f} L/day ({demand:,.1f} m³/year)."
        if demand > 0 else "No daily water demand was entered, so stored water has no direct use."
    )

    dossiers: List[Dict[str, Any]] = []

    # 1. Storage tank
    storage_statement = build_financial_statement("storage_only", s.roof_area, storage, recharge)
    storage_score = scores["storage"]
    dossiers.append({
        "id": "storage",
        "title": "Rooftop Rainwater Storage System",
        "description": "Roof runoff is collected by gutters and downpipes, the first dirty flush is diverted, and the rest passes through a filter into a covered tank for household use.",
        "mechanism": "Gravity flow from roof to tank; a first-flush diverter discards the first ~1.5 mm of each storm, a sand-gravel-charcoal or mesh filter removes debris, and an overflow pipe protects the tank.",
        "justification": " ".join([
            site_line, demand_line,
            f"A {tank:g} m³ tank meets about {_pct(coverage)} of annual demand based on a month-by-month water balance." if demand > 0 else "",
            "Asbestos roofing makes the water unsuitable for drinking; use it only for flushing, washing and gardening." if s.roof_material == "asbestos" else "",
        ]).strip(),
        "dimensions": [
            {"label": "Tank capacity", "value": f"{tank:g} m³ ({_litres(tank)})"},
            {"label": "Minimum capacity for 90% of achievable supply", "value": f"{storage['required_volume']:g} m³"},
            {"label": "Days of demand held when full", "value": f"{storage['storage_days']} days"},
            {"label": "Tank type", "value": "HDPE above-ground tank(s)" if tank <= 10 else "RCC underground sump"},
            {"label": "Downpipes / first-flush units", "value": f"{max(1, -(-int(s.roof_area) // 100))}"},
        ] if tank > 0 else [{"label": "Tank capacity", "value": "Not required (no demand entered)"}],
        "bill_of_materials": [
            "Leaf screens / gutter mesh at every outlet",
            "First-flush diverter on each downpipe",
            "110 mm PVC rainwater pipe with bends, tees and clamps",
            "Filter unit (sand-gravel-charcoal or stainless mesh)",
            f"{'HDPE tank(s)' if tank <= 10 else 'RCC sump: cement, TMT steel, aggregate, waterproofing'} with inlet, outlet, overflow and drain fittings",
            "Mosquito-proof mesh and lockable lid",
        ],
        "installation_steps": [
            "Clean and repair the roof; fix leaf screens on all outlets.",
            "Route gutters to downpipes and fit a first-flush diverter on each downpipe.",
            "Build the tank platform (or excavate and cast the RCC sump for larger tanks).",
            "Install the filter unit upstream of the tank inlet.",
            "Connect inlet, overflow to the storm drain or recharge structure, and an outlet tap / pump connection.",
            "Flush the system with the first rain, then test water quality before potable use.",
        ],
        "financial": _financial(storage_statement),
        "benefits": _benefits(storage["annual_supply"], 0, tariff),
        "maintenance": [
            "Clean roof, gutters and leaf screens before the monsoon and monthly during it.",
            "Empty and reset the first-flush diverter after every rain event.",
            "Wash the filter media every 2-3 months in the monsoon; replace charcoal yearly.",
            "Drain, scrub and disinfect the tank once a year before the rains.",
        ],
        "suitability": {
            "score": storage_score,
            "label": _rating(storage_score),
            "factors": [
                f"Demand coverage {_pct(coverage)}" if demand > 0 else "No demand entered",
                f"Runoff coefficient {h['effective_coefficient']:.2f}",
            ],
        },
    })

    # 2. Recharge pit
    pit_statement = build_financial_statement("recharge_only", s.roof_area, storage, recharge, prefer_trench=False)
    pit_score = scores["recharge_pit"]
    pit_recharge = harvestable * efficiency if recharge["recharge_feasible"] else 0
    dossiers.append({
        "id": "recharge_pit",
        "title": "Groundwater Recharge Pit",
        "description": "A circular pit filled with graded filter media that lets roof runoff soak into the ground and replenish the aquifer.",
        "mechanism": "Runoff passes a silt chamber, then percolates through sand, gravel and boulder layers that filter it before it infiltrates through the pit base and walls.",
        "justification": " ".join([
            site_line, soil_line,
            f"Each pit is sized to hold and absorb one hour of a {40} mm/hr design storm ({recharge['design_runoff']:g} m³ of runoff)."
            if recharge["recharge_feasible"] else "This infiltration rate is below the 2 mm/hr threshold for effective recharge, so a pit is not advised here.",
        ]),
        "dimensions": [
            {"label": "Number of pits", "value": str(pit["count"])},
            {"label": "Diameter", "value": f"{pit['diameter']:g} m"},
            {"label": "Depth", "value": f"{pit['depth']:g} m"},
            {"label": "Filter volume per pit", "value": f"{pit['area'] * pit['depth']:.2f} m³"},
            {"label": "Design storm runoff absorbed", "value": f"{recharge['design_runoff']:g} m³ per hour"},
        ],
        "bill_of_materials": [
            "Boulders 60-100 mm (bottom 50% of depth)",
            "Gravel 10-20 mm (middle 30%)",
            "Coarse sand (top 20%)",
            "Brick-masonry silt / desilting chamber",
            "Perforated RCC cover slab",
            "110 mm PVC inlet pipe, leaf screens and first-flush diverter",
        ],
        "installation_steps": [
            "Mark the pit at least 6 m from foundations, septic tanks and soak pits.",
            f"Excavate to {pit['diameter']:g} m diameter and {pit['depth']:g} m depth.",
            "Fill boulders, then gravel, then coarse sand in graded layers.",
            "Build the silt chamber at the inlet and connect the downpipe through it.",
            "Place the perforated cover slab and provide an overflow to the storm drain.",
        ],
        "financial": _financial(pit_statement),
        "benefits": _benefits(0, pit_recharge, tariff),
        "maintenance": [
            "Desilt the silt chamber before and after the monsoon.",
            "Scrape and replace the top 5-10 cm of sand every year.",
            "Keep the cover slab clear and the inlet screen free of leaves.",
        ],
        "suitability": {
            "score": pit_score,
            "label": _rating(pit_score),
            "factors": [f"Soil infiltration {rate:g} mm/hr", f"{pit['count']} pit(s) required"],
        },
    })

    # 3. Recharge trench
    trench_statement = build_financial_statement("recharge_only", s.roof_area, storage, recharge, prefer_trench=True)
    trench_score = scores["recharge_trench"]
    trench_recharge = harvestable * efficiency if recharge["recharge_feasible"] else 0
    dossiers.append({
        "id": "recharge_trench",
        "title": "Groundwater Recharge Trench",
        "description": "A long, shallow trench filled with filter media and a perforated distribution pipe, suited to large roofs and less permeable or shallow soils.",
        "mechanism": "A perforated pipe spreads runoff along the trench so it infiltrates over a large wetted area; geotextile keeps fine soil out of the media.",
        "justification": " ".join([
            site_line, soil_line,
            "Its larger wetted area makes it better than a pit for slow soils and shallow water tables."
            if s.soil_type in ("clay", "rocky") else "A pit achieves similar recharge on this soil with less excavation length.",
        ]),
        "dimensions": [
            {"label": "Number of trenches", "value": str(trench["count"])},
            {"label": "Length", "value": f"{trench['length']:g} m"},
            {"label": "Width", "value": f"{trench['width']:g} m"},
            {"label": "Depth", "value": f"{trench['depth']:g} m"},
            {"label": "Filter volume", "value": f"{trench['length'] * trench['width'] * trench['depth'] * max(1, trench['count']):.2f} m³"},
        ],
        "bill_of_materials": [
            "Boulders, gravel and coarse sand in graded layers",
            "75 mm perforated PVC distribution pipe",
            "Geotextile filter fabric",
            "Brick-masonry silt chamber at the inlet",
            "110 mm PVC conveyance pipe, leaf screens and first-flush diverter",
        ],
        "installation_steps": [
            "Set out the trench along the plot boundary, 6 m clear of foundations and septic systems.",
            f"Excavate {trench['width']:g} m wide and {trench['depth']:g} m deep for {trench['length']:g} m.",
            "Line with geotextile, lay boulders and gravel, and bed the perforated pipe.",
            "Cover with coarse sand and close the geotextile wrap.",
            "Connect the silt chamber and downpipes; provide an overflow.",
        ],
        "financial": _financial(trench_statement),
        "benefits": _benefits(0, trench_recharge, tariff),
        "maintenance": [
            "Desilt the inlet chamber before and after the monsoon.",
            "Flush the perforated pipe annually.",
            "Replace the top sand layer when ponding lasts more than a day.",
        ],
        "suitability": {
            "score": trench_score,
            "label": _rating(trench_score),
            "factors": [f"Soil infiltration {rate:g} mm/hr", f"{trench['count']} trench(es) of {trench['length']:g} m"],
        },
    })

    # 4. Hybrid
    hybrid_statement = build_financial_statement(
        "hybrid", s.roof_area, storage, recharge, prefer_trench=hybrid_trench
    )
    hybrid_recharge = surplus * efficiency if recharge["recharge_feasible"] else 0
    surplus_share = surplus / harvestable if harvestable > 0 else 0
    hybrid_score = scores["hybrid"]
    dossiers.append({
        "id": "hybrid",
        "title": "Hybrid Storage + Recharge System",
        "description": "A storage tank serves daily needs first; its overflow goes to a recharge structure so no harvested water is wasted.",
        "mechanism": "Filtered runoff fills the tank; once it is full, the overflow pipe feeds the recharge pit or trench, which returns the surplus to the aquifer.",
        "justification": " ".join([
            site_line, demand_line, soil_line,
            f"About {_pct(surplus_share)} of the harvest ({surplus:,.1f} m³) would overflow a {tank:g} m³ tank; "
            + ("routing it to recharge captures that surplus." if surplus_share >= 0.1 else "that surplus is small, so recharge adds little."),
        ]),
        "dimensions": [
            {"label": "Tank capacity", "value": f"{tank:g} m³ ({_litres(tank)})"},
            {"label": "Recharge structure", "value": (
                f"{trench['count']} trench(es), {trench['length']:g} × {trench['width']:g} × {trench['depth']:g} m"
                if hybrid_trench else
                f"{pit['count']} pit(s), {pit['diameter']:g} m Ø × {pit['depth']:g} m"
            )},
            {"label": "Annual overflow to recharge", "value": f"{surplus:,.1f} m³"},
        ],
        "bill_of_materials": [
            "All storage-system components (screens, first-flush, filter, tank, fittings)",
            "Recharge structure filter media and silt chamber",
            "Overflow pipe from tank to recharge structure",
        ],
        "installation_steps": [
            "Build the storage system as described in the storage dossier.",
            "Construct the recharge structure downstream of the tank.",
            "Connect the tank overflow to the recharge silt chamber, with a final overflow to the storm drain.",
            "Commission with the first rain and check both structures drain within 24 hours.",
        ],
        "financial": _financial(hybrid_statement),
        "benefits": _benefits(storage["annual_supply"], hybrid_recharge, tariff),
        "maintenance": [
            "Follow both storage and recharge maintenance schedules.",
            "Check the overflow link stays clear before every monsoon.",
        ],
        "suitability": {
            "score": hybrid_score,
            "label": _rating(hybrid_score),
            "factors": [f"Overflow share {_pct(surplus_share)}", f"Demand coverage {_pct(coverage)}" if demand > 0 else "No demand entered"],
        },
    })

    for dossier in dossiers:
        dossier["recommended"] = dossier["id"] == recommended_id
    # Recommended first, then by score
    dossiers.sort(key=lambda d: (not d["recommended"], -d["suitability"]["score"]))
    return dossiers
