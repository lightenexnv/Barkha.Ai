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
    # Storage is worth most when the stored water actually gets used. A building
    # whose demand dwarfs its roof yield uses every litre, so judge storage by
    # utilisation of the harvest first and by share of demand covered second.
    utilisation = storage["annual_supply"] / harvestable if harvestable > 0 else 0.0
    supply_value = 0.7 * min(1.0, utilisation / 0.7) + 0.3 * min(1.0, coverage / 0.5)
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

    # Recharge alone supplies no water to the building, so it ranks well below
    # storage wherever there is daily demand
    no_demand_bonus = 25 if not has_demand else -20
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
    if 0 < value < 0.01:
        return "under 1%"
    return f"{round(value * 100):d}%"


def _litres(m3: float) -> str:
    return f"{round(m3 * 1000):,} L"


def _clamp(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _rating(score: int) -> str:
    if score >= 80:
        return "Great fit"
    if score >= 60:
        return "Good fit"
    if score >= 40:
        return "Okay fit"
    return "Not a good fit"


def _soak_speed(rate: float) -> str:
    if rate >= 20:
        return "quickly"
    if rate >= 8:
        return "well"
    if rate >= 2:
        return "slowly"
    return "very slowly"


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
            f"{_litres(supplied)} of bought water replaced each year" if supplied > 0 else "Does not replace bought water",
            f"{_litres(recharged)} sent back into the ground each year" if recharged > 0 else "No water sent into the ground",
            f"About ₹{round(supplied * tariff):,} saved each year" if supplied > 0 else "Main benefit: more groundwater, not lower bills",
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
    # Rainwater put to use each year: all of the harvest, up to what the site needs
    water_used = min(h["harvestable_volume"], demand)

    recommended_id = ctx["recommended_dossier"]
    scores = ctx["scores"]
    hybrid_trench = ctx["recharge_kind"] == "trench" if ctx["recharge_kind"] else scores["recharge_trench"] > scores["recharge_pit"]

    site_line = f"Your {s.roof_area:,.0f} m² roof can collect about {_litres(harvestable)} of rain in a year."
    soil_line = f"Water soaks into your {soil} soil {_soak_speed(rate)}."
    demand_line = (
        f"The site uses about {s.water_demand:,.0f} litres a day."
        if demand > 0 else "No daily water use was entered."
    )
    share_used = water_used / demand if demand > 0 else 0.0

    dossiers: List[Dict[str, Any]] = []

    # 1. Storage tank
    storage_statement = build_financial_statement("storage_only", s.roof_area, storage, recharge)
    storage_score = scores["storage"]
    dossiers.append({
        "id": "storage",
        "title": "Rainwater Storage Tank",
        "description": "Rain from the roof is filtered and stored in a covered tank for daily use.",
        "mechanism": "Pipes carry rain from the roof to the tank. The first dirty water is thrown away and a filter cleans the rest.",
        "justification": " ".join([
            site_line, demand_line,
            f"A {_litres(tank)} tank lets you use this rain, covering about {_pct(share_used)} of your yearly water use." if demand > 0 else "",
            "Because the roof is asbestos, use this water for cleaning, toilets or the garden, not for drinking." if s.roof_material == "asbestos" else "",
        ]).strip(),
        "dimensions": [
            {"label": "Tank size", "value": f"{_litres(tank)}"},
            {"label": "Days of water when full", "value": f"{storage['storage_days']} days"},
            {"label": "Tank type", "value": "Plastic tank above ground" if tank <= 10 else "Concrete tank underground"},
            {"label": "Rain pipes with first-flush", "value": f"{max(1, -(-int(s.roof_area) // 100))}"},
        ] if tank > 0 else [{"label": "Tank size", "value": "Not needed (no daily use)"}],
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
        "benefits": _benefits(water_used, 0, tariff),
        "maintenance": [
            "Clean the roof and gutters before the rains.",
            "Empty the first-flush pipe after heavy rain.",
            "Wash the filter every few months.",
            "Clean the tank once a year.",
        ],
        "suitability": {
            "score": storage_score,
            "label": _rating(storage_score),
            "factors": [
                f"Covers {_pct(share_used)} of your water use" if demand > 0 else "No daily use entered",
                f"{s.roof_material.title()} roof",
            ],
        },
    })

    # 2. Recharge pit
    pit_statement = build_financial_statement("recharge_only", s.roof_area, storage, recharge, prefer_trench=False)
    pit_score = scores["recharge_pit"]
    pit_recharge = harvestable * efficiency if recharge["recharge_feasible"] else 0
    dossiers.append({
        "id": "recharge_pit",
        "title": "Recharge Pit",
        "description": "A pit filled with stones and sand that lets roof rain soak into the ground.",
        "mechanism": "Water passes a small silt tank, is filtered by sand and gravel, and soaks into the soil to refill the groundwater.",
        "justification": " ".join([
            site_line, soil_line,
            f"{pit['count']} pit(s) can take the water from a heavy downpour."
            if recharge["recharge_feasible"] else "Water soaks in too slowly here for a pit to work well.",
        ]),
        "dimensions": [
            {"label": "Number of pits", "value": str(pit["count"])},
            {"label": "Width", "value": f"{pit['diameter']:g} m"},
            {"label": "Depth", "value": f"{pit['depth']:g} m"},
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
            "Clean the silt tank before and after the rains.",
            "Replace the top layer of sand once a year.",
        ],
        "suitability": {
            "score": pit_score,
            "label": _rating(pit_score),
            "factors": [f"Water soaks in {_soak_speed(rate)}", f"{pit['count']} pit(s) needed"],
        },
    })

    # 3. Recharge trench
    trench_statement = build_financial_statement("recharge_only", s.roof_area, storage, recharge, prefer_trench=True)
    trench_score = scores["recharge_trench"]
    trench_recharge = harvestable * efficiency if recharge["recharge_feasible"] else 0
    dossiers.append({
        "id": "recharge_trench",
        "title": "Recharge Trench",
        "description": "A long, narrow trench filled with stones that spreads roof rain into the ground. Good for big roofs or slow soil.",
        "mechanism": "A pipe with holes spreads the water along the trench so it soaks into a large area of ground.",
        "justification": " ".join([
            site_line, soil_line,
            "It suits slow-draining ground better than a pit."
            if s.soil_type in ("clay", "rocky") else "A pit would do the same job here with less digging.",
        ]),
        "dimensions": [
            {"label": "Number of trenches", "value": str(trench["count"])},
            {"label": "Length", "value": f"{trench['length']:g} m"},
            {"label": "Width", "value": f"{trench['width']:g} m"},
            {"label": "Depth", "value": f"{trench['depth']:g} m"},
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
            "Clean the silt tank before and after the rains.",
            "Flush the pipe once a year.",
        ],
        "suitability": {
            "score": trench_score,
            "label": _rating(trench_score),
            "factors": [f"Water soaks in {_soak_speed(rate)}", f"{trench['count']} trench(es) of {trench['length']:g} m"],
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
        "title": "Storage Tank + Recharge",
        "description": "A tank stores rain for daily use. When it is full, the extra water goes into the ground instead of being wasted.",
        "mechanism": "The tank fills first. Its overflow pipe leads to a recharge pit or trench.",
        "justification": " ".join([
            site_line, demand_line, soil_line,
            (f"About {_pct(surplus_share)} of the rain would overflow the tank; sending it into the ground puts it to use."
             if surplus_share >= 0.1 else "Only a little water would overflow, so the recharge part adds a small benefit."),
        ]),
        "dimensions": [
            {"label": "Tank size", "value": f"{_litres(tank)}"},
            {"label": "Recharge part", "value": (
                f"{trench['count']} trench(es), {trench['length']:g} m long"
                if hybrid_trench else
                f"{pit['count']} pit(s), {pit['diameter']:g} m wide, {pit['depth']:g} m deep"
            )},
            {"label": "Extra water sent into the ground", "value": f"{_litres(surplus)} a year"},
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
        "benefits": _benefits(water_used, hybrid_recharge, tariff),
        "maintenance": [
            "Look after the tank and the pit as shown above.",
            "Keep the overflow pipe clear before the rains.",
        ],
        "suitability": {
            "score": hybrid_score,
            "label": _rating(hybrid_score),
            "factors": [f"{_pct(surplus_share)} extra water to the ground", f"Covers {_pct(share_used)} of your water use" if demand > 0 else "No daily use entered"],
        },
    })

    for dossier in dossiers:
        dossier["recommended"] = dossier["id"] == recommended_id
    # Recommended first, then by score
    dossiers.sort(key=lambda d: (not d["recommended"], -d["suitability"]["score"]))
    return dossiers
