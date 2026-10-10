"""
Text Report Generator Service
Generates plain text reports for rainwater harvesting assessments
"""

import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
from models.db_models import Assessment

logger = logging.getLogger(__name__)

async def generate_assessment_text(assessment: Assessment) -> Path:
    """
    Generate a plain text report for the assessment
    
    Args:
        assessment: Assessment object containing all data
        
    Returns:
        Path to the generated text file
    """
    try:
        logger.info(f"Generating text report for assessment {assessment.id}")
        
        # Create output directory
        output_dir = Path("rtrwh_reports")
        output_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        import uuid
        filename = f"assessment_{str(assessment.id)[:8]}_{uuid.uuid4().hex[:8]}.txt"
        text_path = output_dir / filename
        
        # Generate text content
        text_content = _generate_text_content(assessment)
        
        # Write to file
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text_content)
        
        # Verify file was created
        if not text_path.exists():
            raise Exception("Text file was not created")
        
        file_size = text_path.stat().st_size
        if file_size < 100:
            raise Exception("Text file is too small")
        
        logger.info(f"Text report generated successfully at {text_path}, size: {file_size} bytes")
        return text_path
        
    except Exception as e:
        logger.error(f"Failed to generate text report: {e}")
        raise

def _num(value, default=0.0) -> float:
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _text(value, default="N/A") -> str:
    return str(value) if value not in (None, "") else default


def _generate_text_content(assessment: Assessment) -> str:
    """Generate the text content for the assessment report"""

    # Optional fields may be missing on guest or partial records, so every
    # value goes through _num/_text instead of being formatted directly
    assessment_data = assessment.assessment_data or {}
    recommendations = assessment.recommendations or {}

    content = []
    content.append("=" * 80)
    content.append("RAINWATER HARVESTING ASSESSMENT REPORT")
    content.append("=" * 80)
    content.append(f"Assessment ID: {assessment.id}")
    content.append(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    content.append("")

    content.append("SITE DETAILS")
    content.append("-" * 40)
    content.append(f"Site Name: {_text(assessment.site_name)}")
    location = assessment_data.get('location') or {}
    place = ", ".join(dict.fromkeys(p for p in (location.get('city'), location.get('district'), location.get('state')) if p))
    if place:
        content.append(f"Place: {place}")
    content.append(f"Location: {_num(assessment.latitude):.6f}, {_num(assessment.longitude):.6f}")
    content.append(f"Roof Area: {_num(assessment.roof_area):.2f} m²")
    content.append(f"Roof Material: {_text(assessment.roof_material).title()}")
    content.append(f"Roof Condition: {_text(assessment.roof_condition).title()}")
    content.append(f"Soil Type: {_text(assessment.soil_type).title()}")
    content.append(f"Annual Rainfall: {_num(assessment.annual_rainfall):.0f} mm")
    if location.get('rainfall_period'):
        content.append(f"Rainfall Basis: mean of {location.get('rainfall_period')} ({_text(location.get('rainfall_source'))})")
    content.append(f"Daily Water Demand: {_num(assessment.water_demand):.2f} L/day")
    content.append("")

    content.append("ASSESSMENT RESULTS")
    content.append("-" * 40)
    content.append(f"Harvestable Volume: {_num(assessment_data.get('harvestable_volume')):.2f} m³/year")

    # Records saved before the key names were unified use the older names
    storage_rec = assessment_data.get('storage_recommendation') or assessment_data.get('storage_requirement') or {}
    if storage_rec:
        content.append(f"Required Storage Volume: {_num(storage_rec.get('required_volume')):.2f} m³")
        content.append(f"Recommended Storage Volume: {_num(storage_rec.get('recommended_volume')):.2f} m³")
        content.append(f"Storage Days: {_text(storage_rec.get('storage_days'), '0')} days")

    recharge_rec = assessment_data.get('recharge_recommendation') or assessment_data.get('recharge_requirement') or {}
    if recharge_rec:
        content.append("")
        content.append("RECHARGE STRUCTURE RECOMMENDATIONS")
        content.append("-" * 40)

        recharge_pit = recharge_rec.get('recharge_pit') or {}
        if recharge_pit:
            content.append(f"Recharge Pit Diameter: {_num(recharge_pit.get('diameter')):.2f} m")
            content.append(f"Recharge Pit Depth: {_num(recharge_pit.get('depth')):.2f} m")
            content.append(f"Recharge Pit Area: {_num(recharge_pit.get('area')):.2f} m²")

        recharge_trench = recharge_rec.get('recharge_trench') or {}
        if recharge_trench:
            content.append(
                f"Recharge Trench: {_num(recharge_trench.get('length')):.2f}m x "
                f"{_num(recharge_trench.get('width')):.2f}m x {_num(recharge_trench.get('depth')):.2f}m"
            )

        content.append(f"Infiltration Rate: {_num(recharge_rec.get('infiltration_rate')):.2f} mm/hr")
        content.append(f"Suitability Score: {_text(recharge_rec.get('suitability_score'), '0')}/10")

    content.append("")

    if recommendations:
        content.append("RECOMMENDATIONS")
        content.append("-" * 40)
        recommended_option = _text(recommendations.get('recommended_option'), 'unknown')
        content.append(f"Recommended Option: {recommended_option.replace('_', ' ').title()}")
        content.append("")

        dossiers = [d for d in (assessment_data.get('dossiers') or []) if isinstance(d, dict)]
        chosen = next((d for d in dossiers if d.get('recommended')), None)
        if chosen:
            content.extend(_dossier_lines(chosen))

        statement = assessment_data.get('financial_statement') or {}
        if statement:
            content.extend(_statement_lines(statement))

        subsidies = assessment_data.get('subsidies') or {}
        if subsidies:
            content.extend(_subsidy_lines(subsidies))

        cost_analysis = recommendations.get('cost_analysis') or recommendations.get('costs') or {}
        if cost_analysis and not statement:
            content.append("COST ANALYSIS")
            content.append("-" * 20)
            for label, key in (
                ("Storage Tank Cost", "storage_tank_cost"),
                ("Recharge Structure Cost", "recharge_structure_cost"),
                ("Piping Cost", "piping_cost"),
                ("Filtration Cost", "filtration_cost"),
                ("Labor Cost", "labor_cost"),
                ("Material Contingency", "material_contingency"),
                ("Tax", "tax"),
            ):
                content.append(f"{label}: ₹{_num(cost_analysis.get(key)):,.2f}")
            content.append(f"TOTAL COST: ₹{_num(cost_analysis.get('total_cost')):,.2f}")
            content.append("")

        savings_analysis = recommendations.get('savings_analysis') or recommendations.get('savings') or {}
        if savings_analysis:
            content.append("SAVINGS ANALYSIS")
            content.append("-" * 20)
            content.append(f"Annual Water Saved: {_num(savings_analysis.get('annual_water_saved')):.2f} m³")
            content.append(f"Annual Cost Savings: ₹{_num(savings_analysis.get('annual_cost_savings')):,.2f}")
            content.append(f"Monthly Savings: ₹{_num(savings_analysis.get('monthly_savings')):,.2f}")
            content.append(f"Water Tariff Used: ₹{_num(savings_analysis.get('water_tariff_used')):.2f}/m³")
            content.append("")

        content.append(f"PAYBACK PERIOD: {_text(recommendations.get('payback_period'))} years")
        content.append("")

        safety_checks = recommendations.get('safety_checks') or []
        if safety_checks:
            content.append("SAFETY CHECKS & WARNINGS")
            content.append("-" * 30)
            for check in safety_checks:
                content.append(f"• {check}")
            content.append("")

        bill_of_quantities = recommendations.get('bill_of_quantities') or {}
        if bill_of_quantities and not statement:
            content.append("BILL OF QUANTITIES")
            content.append("-" * 20)
            for item in bill_of_quantities.get('items') or []:
                content.append(
                    f"{_text(item.get('item'))}: {_text(item.get('quantity'))} @ "
                    f"₹{_num(item.get('rate')):,.2f} = ₹{_num(item.get('amount')):,.2f}"
                )
            content.append(f"TOTAL: ₹{_num(bill_of_quantities.get('total_cost')):,.2f}")
            content.append("")

    content.append("=" * 80)
    content.append("END OF REPORT")
    content.append("=" * 80)

    return "\n".join(content)


def _dossier_lines(dossier: dict) -> list:
    suitability = dossier.get('suitability') or {}
    lines = [
        "RECOMMENDED SYSTEM DOSSIER",
        "-" * 40,
        f"{_text(dossier.get('title'))} (suitability {_text(suitability.get('score'), '0')}/100, {_text(suitability.get('label'))})",
        "",
        _text(dossier.get('description'), ''),
        _text(dossier.get('mechanism'), ''),
        "",
        "Why this suits the site:",
        _text(dossier.get('justification'), ''),
        "",
        "Dimensions & capacity:",
    ]
    lines += [f"  {_text(d.get('label'))}: {_text(d.get('value'))}" for d in dossier.get('dimensions') or []]
    for title, key, numbered in (("Required materials", 'bill_of_materials', False),
                                 ("Installation process", 'installation_steps', True),
                                 ("Maintenance protocol", 'maintenance', False)):
        items = dossier.get(key) or []
        if items:
            lines += ["", f"{title}:"]
            lines += [f"  {i}. {item}" if numbered else f"  - {item}" for i, item in enumerate(items, 1)]
    benefits = (dossier.get('benefits') or {}).get('summary') or []
    if benefits:
        lines += ["", "Quantified benefits:"] + [f"  - {b}" for b in benefits]
    lines.append("")
    return lines


def _statement_lines(statement: dict) -> list:
    def part(title: str, rows: list, subtotal_label: str, subtotal) -> list:
        out = [title, f"{'S.No.':<6}{'Item':<52}{'Qty':>12}{'Unit price':>14}{'Amount':>14}"]
        for r in rows:
            qty = f"{_num(r.get('quantity')):g} {r.get('unit', '')}"
            out.append(f"{_text(r.get('sno'), ''):<6}{_text(r.get('description'))[:50]:<52}{qty:>12}"
                       f"{_num(r.get('unit_price')):>14,.0f}{_num(r.get('amount')):>14,.0f}")
        out.append(f"{subtotal_label:<84}{_num(subtotal):>14,.0f}")
        return out + [""]

    lines = ["COST ESTIMATION STATEMENT (₹, indicative, GST inclusive)", "-" * 40]
    lines += part("Part A - Materials & Supplies", statement.get('materials') or [], "Materials subtotal (A)",
                  statement.get('materials_subtotal'))
    lines += part("Part B - Additional Project Expenses", statement.get('additional') or [], "Additional costs subtotal (B)",
                  statement.get('additional_subtotal'))
    pct = round(_num(statement.get('contingency_rate')) * 100)
    lines += [
        "Part C - Estimated Gross Project Cost",
        f"  Materials subtotal (A):            ₹{_num(statement.get('materials_subtotal')):,.0f}",
        f"+ Additional costs subtotal (B):     ₹{_num(statement.get('additional_subtotal')):,.0f}",
        f"+ Contingency allowance ({pct}%):      ₹{_num(statement.get('contingency')):,.0f}",
        f"= TOTAL ESTIMATED PROJECT COST:      ₹{_num(statement.get('total_cost')):,.0f} (before subsidy)",
        _text(statement.get('rates_note'), ''),
        "",
    ]
    return lines


def _subsidy_lines(subsidies: dict) -> list:
    lines = ["GOVERNMENT SUBSIDY OPPORTUNITIES", "-" * 40]
    for scheme in subsidies.get('schemes') or []:
        lines.append(f"* {_text(scheme.get('name'))} - {_text(scheme.get('authority'))}")
        lines.append(f"    Assistance: {_text(scheme.get('assistance'))}")
        if _num(scheme.get('indicative_grant')) > 0:
            lines.append(f"    Indicative grant for this project: up to ₹{_num(scheme.get('indicative_grant')):,.0f}")
        lines.append(f"    Eligibility: {_text(scheme.get('eligibility'))}")
        lines.append(f"    How to apply: {_text(scheme.get('how_to_apply'))} ({_text(scheme.get('portal'))})")
    lines += [
        "",
        f"Total estimated project cost:         ₹{_num(subsidies.get('gross_cost')):,.0f}",
        f"- Indicative subsidy:                 ₹{_num(subsidies.get('indicative_subsidy')):,.0f}",
        f"= Indicative net cost (projection):   ₹{_num(subsidies.get('indicative_net_cost')):,.0f}",
        f"DISCLAIMER: {_text(subsidies.get('disclaimer'), '')}",
        "",
    ]
    return lines
