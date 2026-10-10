"""
Itemised cost statement for a rainwater harvesting configuration.

Part A lists materials, Part B the work needed to install them, and Part C
adds a contingency. Unit rates are indicative 2025 Indian market rates
including GST, so no separate tax line is added.
"""
import math
from typing import Any, Dict, List

CONTINGENCY_RATE = 0.10

# ₹, GST inclusive
RATES = {
    "hdpe_tank_per_litre": 7.0,
    "rcc_sump_materials_per_m3": 6500.0,
    "rcc_sump_civil_per_m3": 3500.0,
    "leaf_screen": 850.0,
    "first_flush": 2800.0,
    "pvc_110_per_m": 260.0,
    "fittings_share": 0.18,
    "storage_filter": 6500.0,
    "tank_fittings": 1800.0,
    "boulders_per_m3": 1500.0,
    "gravel_per_m3": 1900.0,
    "sand_per_m3": 2300.0,
    "pit_cover_slab": 3500.0,
    "perforated_75_per_m": 180.0,
    "geotextile_per_m2": 120.0,
    "excavation_per_m3": 380.0,
    "silt_chamber": 4500.0,
    "tank_platform": 3000.0,
    "plumber_day": 1000.0,
    "mason_day": 950.0,
    "helper_day": 650.0,
    "transport_share": 0.04,
    "transport_min": 1500.0,
}

STORAGE_CODES = ("storage_only", "hybrid", "storage_priority_hybrid")
RECHARGE_CODES = ("recharge_only", "hybrid", "storage_priority_hybrid")


def _row(description: str, quantity: float, unit: str, unit_price: float, component: str) -> Dict[str, Any]:
    quantity = round(quantity, 2)
    return {
        "description": description,
        "quantity": quantity,
        "unit": unit,
        "unit_price": round(unit_price, 2),
        "amount": round(quantity * unit_price, 2),
        "component": component,
    }


def _number(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    for index, row in enumerate(rows, start=1):
        row["sno"] = index
    return rows


def build_financial_statement(
    recommendation: str,
    roof_area: float,
    storage: Dict[str, Any],
    recharge: Dict[str, Any],
    prefer_trench: bool = False,
) -> Dict[str, Any]:
    materials: List[Dict[str, Any]] = []
    additional: List[Dict[str, Any]] = []
    uses_storage = recommendation in STORAGE_CODES and storage.get("recommended_volume", 0) > 0
    uses_recharge = recommendation in RECHARGE_CODES and recharge.get("recharge_feasible", True)

    if recommendation == "not_feasible" or roof_area <= 0 or not (uses_storage or uses_recharge):
        return _finish(materials, additional, recharge_kind=None)

    # Conveyance: one downpipe per 100 m² of roof
    downpipes = max(1, math.ceil(roof_area / 100))
    pipe_length = round(1.5 * math.sqrt(roof_area) + 6 * downpipes)
    materials.append(_row("Rooftop leaf screen / gutter mesh", max(1, math.ceil(roof_area / 50)), "no.", RATES["leaf_screen"], "conveyance"))
    materials.append(_row("First-flush diverter (manual/auto)", downpipes, "no.", RATES["first_flush"], "conveyance"))
    materials.append(_row("PVC rainwater pipe, 110 mm (6 kgf)", pipe_length, "m", RATES["pvc_110_per_m"], "conveyance"))
    materials.append(_row(
        "PVC bends, tees, clamps and solvent (lot)", 1, "lot",
        pipe_length * RATES["pvc_110_per_m"] * RATES["fittings_share"], "conveyance",
    ))

    plumber_days, mason_days, helper_days = 1 + downpipes, 0.0, 1.0
    excavation = 0.0

    if uses_storage:
        volume = storage["recommended_volume"]
        materials.append(_row("Storage filter unit (sand-gravel-charcoal / mesh)", 1, "set", RATES["storage_filter"], "storage"))
        materials.append(_row("Tank inlet, outlet, overflow and drain fittings", 1, "set", RATES["tank_fittings"], "storage"))
        if volume <= 10:
            materials.append(_row(f"HDPE storage tank(s), {volume:g} m³ total", volume * 1000, "L", RATES["hdpe_tank_per_litre"], "storage"))
            additional.append(_row("Tank platform / plinth (civil work)", 1, "no.", RATES["tank_platform"], "storage"))
            plumber_days += 1
        else:
            materials.append(_row("RCC sump materials (cement, TMT steel, aggregate, waterproofing)", volume, "m³", RATES["rcc_sump_materials_per_m3"], "storage"))
            additional.append(_row("RCC sump civil & masonry work", volume, "m³", RATES["rcc_sump_civil_per_m3"], "storage"))
            excavation += volume * 1.2
            mason_days += math.ceil(volume / 5)
            helper_days += math.ceil(volume / 5)

    recharge_kind = None
    if uses_recharge:
        recharge_kind = "trench" if prefer_trench else "pit"
        if recharge_kind == "pit":
            pit = recharge["recharge_pit"]
            count = max(1, pit.get("count") or 1)
            volume = pit["area"] * pit["depth"] * count
            structures = count
            excavation += volume
            materials.append(_row("Boulders, 60-100 mm (bottom layer)", volume * 0.5, "m³", RATES["boulders_per_m3"], "recharge"))
            materials.append(_row("Gravel, 10-20 mm (middle layer)", volume * 0.3, "m³", RATES["gravel_per_m3"], "recharge"))
            materials.append(_row("Coarse sand (top filter layer)", volume * 0.2, "m³", RATES["sand_per_m3"], "recharge"))
            materials.append(_row("Perforated RCC cover slab", count, "no.", RATES["pit_cover_slab"], "recharge"))
            mason_days += 2 * count
            helper_days += 3 * count
        else:
            trench = recharge["recharge_trench"]
            count = max(1, trench.get("count") or 1)
            length = trench["length"] * count
            volume = length * trench["width"] * trench["depth"]
            structures = count
            excavation += volume
            materials.append(_row("Boulders, 60-100 mm (bottom layer)", volume * 0.5, "m³", RATES["boulders_per_m3"], "recharge"))
            materials.append(_row("Gravel, 10-20 mm (middle layer)", volume * 0.3, "m³", RATES["gravel_per_m3"], "recharge"))
            materials.append(_row("Coarse sand (top filter layer)", volume * 0.2, "m³", RATES["sand_per_m3"], "recharge"))
            materials.append(_row("Perforated PVC pipe, 75 mm (distribution)", length, "m", RATES["perforated_75_per_m"], "recharge"))
            materials.append(_row("Geotextile filter fabric", length * (trench["width"] + 2 * trench["depth"]), "m²", RATES["geotextile_per_m2"], "recharge"))
            mason_days += max(1, math.ceil(length / 8))
            helper_days += max(2, math.ceil(length / 4))
        additional.append(_row("Silt / desilting chamber (brick masonry)", structures, "no.", RATES["silt_chamber"], "recharge"))
        mason_days += structures

    if excavation > 0:
        additional.append(_row("Excavation & earthwork incl. disposal", excavation, "m³", RATES["excavation_per_m3"], "civil"))
    additional.append(_row("Plumber - pipework & installation", plumber_days, "day", RATES["plumber_day"], "labour"))
    if mason_days:
        additional.append(_row("Mason - masonry, filter laying & finishing", mason_days, "day", RATES["mason_day"], "labour"))
    additional.append(_row("Helpers / unskilled labour", helper_days, "day", RATES["helper_day"], "labour"))

    materials_total = sum(row["amount"] for row in materials)
    transport = max(RATES["transport_min"], materials_total * RATES["transport_share"])
    additional.append(_row("Transport, loading & site handling (lump sum)", 1, "lot", transport, "civil"))
    return _finish(materials, additional, recharge_kind)


def _finish(materials: List[Dict[str, Any]], additional: List[Dict[str, Any]], recharge_kind) -> Dict[str, Any]:
    materials_subtotal = round(sum(row["amount"] for row in materials), 2)
    additional_subtotal = round(sum(row["amount"] for row in additional), 2)
    contingency = round((materials_subtotal + additional_subtotal) * CONTINGENCY_RATE, 2)
    total = round(materials_subtotal + additional_subtotal + contingency, 2)

    def component_total(rows, *components):
        return round(sum(row["amount"] for row in rows if row["component"] in components), 2)

    labour = component_total(additional, "labour")
    legacy = {
        "storage_tank_cost": component_total(materials + additional, "storage"),
        "recharge_structure_cost": component_total(materials + additional, "recharge"),
        "piping_cost": round(sum(r["amount"] for r in materials if r["component"] == "conveyance" and "PVC" in r["description"]), 2),
        "filtration_cost": round(sum(r["amount"] for r in materials if r["component"] == "conveyance" and "PVC" not in r["description"]), 2),
        "labor_cost": labour,
        "excavation_and_transport": component_total(additional, "civil"),
        "material_contingency": contingency,
        "tax": 0.0,
        "total_cost": total,
    }
    return {
        "materials": _number(materials),
        "materials_subtotal": materials_subtotal,
        "additional": _number(additional),
        "additional_subtotal": additional_subtotal,
        "contingency_rate": CONTINGENCY_RATE,
        "contingency": contingency,
        "total_cost": total,
        "recharge_kind": recharge_kind,
        "rates_note": "Indicative 2025 Indian market rates inclusive of GST; obtain local quotations before work.",
        "legacy_cost_analysis": legacy,
    }
