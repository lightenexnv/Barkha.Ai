"""
Material requirement sheet: what to buy for the recommended system, with
quantities but no prices, so it can be sent to shops to get quotations.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from services.pdf_generator import (
    CONTENT_W, MARGIN, REPORTS_DIR, _kv_table, _page_decor, _Styles, _table, clean, safe_float, safe_str,
)

SYSTEM_TITLES = {
    "storage_only": "Rooftop rainwater storage tank",
    "recharge_only": "Groundwater recharge structure",
    "hybrid": "Rainwater storage tank with groundwater recharge",
    "storage_priority_hybrid": "Rainwater storage tank with groundwater recharge",
}


def material_rows(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Materials (Part A of the cost statement) without any price fields."""
    statement = result.get("financial_statement") or {}
    rows = statement.get("materials") or []
    return [
        {"item": safe_str(r.get("description"), ""), "quantity": safe_float(r.get("quantity")), "unit": safe_str(r.get("unit"), "")}
        for r in rows
        if safe_str(r.get("description"), "")
    ]


def generate_material_sheet(site: Dict[str, Any], result: Dict[str, Any]) -> str:
    rows = material_rows(result)
    if not rows:
        raise ValueError("This plan has no materials to list.")

    REPORTS_DIR.mkdir(exist_ok=True)
    path = REPORTS_DIR / f"materials_{uuid.uuid4().hex}.pdf"
    st = _Styles()
    today = datetime.now().strftime("%d %b %Y")

    recommended = next((d for d in result.get("dossiers") or [] if d.get("recommended")), None)
    system = (recommended or {}).get("title") or SYSTEM_TITLES.get(result.get("recommended_option", ""), "Rooftop rainwater harvesting system")
    place = ", ".join(dict.fromkeys(p for p in (site.get("city"), site.get("district"), site.get("state")) if p))

    summary = [
        ["Site", safe_str(site.get("site_name"))],
        ["Location", place or f"{safe_float(site.get('latitude')):.4f}, {safe_float(site.get('longitude')):.4f}"],
        ["System", system],
        ["Roof area", f"{safe_float(site.get('roof_area')):,.0f} m2 ({safe_str(site.get('roof_material')).title()} roof)"],
    ] + [[d.get("label"), d.get("value")] for d in (recommended or {}).get("dimensions") or []]

    table_rows = [[Paragraph(h, st.cell_head) for h in ("S.No.", "Item")] + [Paragraph("Quantity", st.cell_head_right)]]
    for i, row in enumerate(rows, start=1):
        qty = f"{row['quantity']:g} {row['unit']}".strip()
        table_rows.append([Paragraph(str(i), st.cell), Paragraph(clean(row["item"]), st.cell), Paragraph(clean(qty), st.cell_right)])

    story = [
        Paragraph("Material Requirement Sheet", st.title),
        Paragraph(f"Rooftop rainwater harvesting  |  {today}", st.subtitle),
        _kv_table(summary, st),
        Paragraph("Materials required", st.h2),
        _table(table_rows, [CONTENT_W * 0.08, CONTENT_W * 0.66, CONTENT_W * 0.26]),
        Spacer(1, 10),
        Paragraph(
            "Please share your best quotation and delivery time for the items above. Quantities are estimates "
            "for this site; the installer may adjust them after a site visit.",
            st.body,
        ),
        Spacer(1, 18),
        Paragraph("Contact name: ______________________     Mobile: ______________________", st.body),
    ]

    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=2.4 * cm, bottomMargin=1.9 * cm,
        title="Material Requirement Sheet", author="Barkha.Ai",
    )
    stamp = datetime.now().strftime("%d %b %Y, %H:%M")
    doc.build(story, onFirstPage=lambda c, d: _page_decor(c, d, stamp), onLaterPages=lambda c, d: _page_decor(c, d, stamp))
    return str(path)
