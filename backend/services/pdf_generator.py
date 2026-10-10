"""
Branded PDF report for an RTRWH assessment.

Every section is built defensively: records can come from older engine
versions, guest sessions or the direct-report endpoint, so any field may be
missing. A section that fails is replaced by a short note instead of
aborting the whole report.
"""
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image, KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from models.db_models import Assessment

logger = logging.getLogger(__name__)

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "brand" / "barkha-logo-horizontal.png"
REPORTS_DIR = Path("rtrwh_reports")

NAVY = colors.HexColor("#0B3B6E")
BRAND = colors.HexColor("#0277B8")
CYAN = colors.HexColor("#11A0AD")
MIST = colors.HexColor("#EAF5FB")
LINE = colors.HexColor("#C9DCEA")
GREEN = colors.HexColor("#15803D")
AMBER = colors.HexColor("#B45309")
RED = colors.HexColor("#B91C1C")
MUTED = colors.HexColor("#5B6B7A")

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

RECOMMENDATION_LABELS = {
    "storage_only": "Storage System Only",
    "recharge_only": "Groundwater Recharge Only",
    "hybrid": "Hybrid System (Storage + Recharge)",
    "storage_priority_hybrid": "Storage-Priority Hybrid",
    "not_feasible": "Not Feasible",
}

# The built-in Helvetica covers Latin-1/cp1252 only; map the few symbols the
# engine uses that fall outside it.
_REPLACEMENTS = {"₹": "Rs. ", "≈": "~", "≥": ">=", "≤": "<=", "→": "->", "⌀": "Ø", "✓": "", "•": "-"}


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number == number and abs(number) != float("inf") else default


def safe_str(value: Any, default: str = "N/A") -> str:
    if value is None or value == "":
        return default
    return str(value)


def clean(text: Any) -> str:
    """Make text safe for ReportLab: supported glyphs only, XML-escaped."""
    s = safe_str(text, "")
    for old, new in _REPLACEMENTS.items():
        s = s.replace(old, new)
    s = s.encode("cp1252", errors="replace").decode("cp1252")
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def authority_line(scheme: Dict[str, Any]) -> str:
    """Issuing authority, with the level appended unless the name already states it."""
    authority, level = safe_str(scheme.get("authority"), ""), safe_str(scheme.get("level"), "")
    return authority if not level or f"({level}" in authority else f"{authority} ({level})"


def rupees(value: Any) -> str:
    return f"Rs. {safe_float(value):,.0f}"


class _Styles:
    def __init__(self):
        base = getSampleStyleSheet()
        self.body = ParagraphStyle("Body", parent=base["Normal"], fontName="Helvetica", fontSize=9.5, leading=13)
        self.small = ParagraphStyle("Small", parent=self.body, fontSize=8, leading=10.5, textColor=MUTED)
        self.cell = ParagraphStyle("Cell", parent=self.body, fontSize=8.5, leading=11)
        self.cell_right = ParagraphStyle("CellRight", parent=self.cell, alignment=TA_RIGHT)
        self.cell_head = ParagraphStyle("CellHead", parent=self.cell, fontName="Helvetica-Bold", textColor=colors.white)
        self.cell_head_right = ParagraphStyle("CellHeadRight", parent=self.cell_head, alignment=TA_RIGHT)
        self.title = ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=20,
                                    leading=24, textColor=NAVY, alignment=0, spaceAfter=2)
        self.subtitle = ParagraphStyle("Subtitle", parent=self.body, fontSize=10, textColor=MUTED, spaceAfter=10)
        self.h2 = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13.5,
                                 leading=17, textColor=NAVY, spaceBefore=12, spaceAfter=6)
        self.h3 = ParagraphStyle("H3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=10.5,
                                 leading=13, textColor=BRAND, spaceBefore=8, spaceAfter=3)


def _table(rows: List[List[Any]], widths: List[float], header: bool = True, total_rows: int = 0,
           zebra: bool = True) -> Table:
    table = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), NAVY)]
    if zebra:
        start = 1 if header else 0
        for r in range(start, len(rows) - total_rows):
            if (r - start) % 2 == 1:
                style.append(("BACKGROUND", (0, r), (-1, r), MIST))
    for r in range(len(rows) - total_rows, len(rows)):
        style += [("BACKGROUND", (0, r), (-1, r), colors.HexColor("#DCEEF8")),
                  ("LINEABOVE", (0, r), (-1, r), 0.8, BRAND)]
    table.setStyle(TableStyle(style))
    return table


def _kv_table(pairs: List[List[str]], st: _Styles) -> Table:
    rows = [[Paragraph(clean(k), st.cell), Paragraph(clean(v), st.cell)] for k, v in pairs]
    return _table(rows, [CONTENT_W * 0.38, CONTENT_W * 0.62], header=False)


def _bullets(items: List[str], st: _Styles, ordered: bool = False) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(clean(item), st.body), leftIndent=12) for item in items if safe_str(item, "").strip()],
        bulletType="1" if ordered else "bullet",
        start="1" if ordered else None,
        bulletFontSize=8,
        leftIndent=12,
    )


def _page_decor(canvas, doc, generated: str):
    canvas.saveState()
    top = PAGE_H - 1.1 * cm
    if LOGO_PATH.exists():
        canvas.drawImage(str(LOGO_PATH), MARGIN, top - 0.75 * cm, width=2.9 * cm, height=0.74 * cm,
                         preserveAspectRatio=True, mask="auto")
    else:
        canvas.setFont("Helvetica-Bold", 12)
        canvas.setFillColor(NAVY)
        canvas.drawString(MARGIN, top - 0.5 * cm, "Barkha.Ai")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, top - 0.45 * cm, "Rooftop Rainwater Harvesting Assessment")
    canvas.setStrokeColor(CYAN)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, top - 0.95 * cm, PAGE_W - MARGIN, top - 0.95 * cm)

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 1.35 * cm, PAGE_W - MARGIN, 1.35 * cm)
    canvas.drawString(MARGIN, 0.9 * cm, f"Barkha.Ai  |  Generated {generated}  |  Indicative estimates; verify locally before construction.")
    canvas.drawRightString(PAGE_W - MARGIN, 0.9 * cm, f"Page {doc.page}")
    canvas.restoreState()


def _guard(story: list, st: _Styles, name: str, build: Callable[[], List[Any]]):
    """Append a section, or a short note if it cannot be built."""
    try:
        story.extend(build())
    except Exception as e:  # noqa: BLE001 - one bad section must not sink the report
        logger.error(f"PDF section '{name}' failed: {e}", exc_info=True)
        story.append(Paragraph(f"{clean(name)}: this section could not be generated.", st.small))


async def generate_assessment_pdf(assessment: Assessment) -> str:
    """Build the PDF report and return its path."""
    if not isinstance(assessment, Assessment):
        raise ValueError("Assessment must be an instance of Assessment model")

    REPORTS_DIR.mkdir(exist_ok=True)
    pdf_path = REPORTS_DIR / f"assessment_{assessment.id}_{uuid.uuid4().hex}.pdf"
    generated = datetime.now().strftime("%d %b %Y, %H:%M")
    st = _Styles()

    data: Dict[str, Any] = assessment.assessment_data or {}
    rec: Dict[str, Any] = assessment.recommendations or {}
    location: Dict[str, Any] = data.get("location") or {}
    hydrology: Dict[str, Any] = data.get("hydrology") or {}
    statement: Optional[Dict[str, Any]] = data.get("financial_statement") or None
    subsidies: Optional[Dict[str, Any]] = data.get("subsidies") or None
    dossiers: List[Dict[str, Any]] = [d for d in (data.get("dossiers") or []) if isinstance(d, dict)]
    storage = data.get("storage_recommendation") or data.get("storage_requirement") or {}
    recharge = data.get("recharge_recommendation") or data.get("recharge_requirement") or {}
    savings = rec.get("savings_analysis") or rec.get("savings") or {}
    code = safe_str(rec.get("recommended_option"), "unknown")

    story: List[Any] = []

    # ---- Title ----
    def title():
        place = ", ".join(dict.fromkeys(p for p in (location.get("city"), location.get("district"), location.get("state")) if p))
        return [
            Paragraph("Rainwater Harvesting Assessment Report", st.title),
            Paragraph(f"{clean(assessment.site_name or 'Site')}{(' - ' + clean(place)) if place else ''}"
                      f"  |  Ref. {clean(str(assessment.id)[:8].upper())}  |  {generated}", st.subtitle),
        ]
    _guard(story, st, "Title", title)

    # ---- Key results ----
    def key_results():
        harvest = safe_float(data.get("harvestable_volume"))
        total = safe_float((statement or {}).get("total_cost"), safe_float((rec.get("cost_analysis") or {}).get("total_cost")))
        payback = safe_str(rec.get("payback_period"))
        cells = [
            ("Harvestable water", f"{harvest:,.1f} m3/yr", f"{harvest * 1000:,.0f} litres a year"),
            ("Recommended system", RECOMMENDATION_LABELS.get(code, code.replace("_", " ").title()), ""),
            ("Estimated cost", rupees(total), "before subsidy"),
            ("Annual savings", rupees(savings.get("annual_cost_savings")),
             f"payback {payback} yrs" if payback not in ("N/A", "None") else "no bill savings"),
        ]
        big = ParagraphStyle("Big", parent=st.body, fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=NAVY)
        row = [[Paragraph(clean(label), st.small), Paragraph(clean(value), big), Paragraph(clean(note), st.small)]
               for label, value, note in cells]
        grid = Table([row], colWidths=[CONTENT_W / 4] * 4)
        grid.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), MIST),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        return [grid, Spacer(1, 0.3 * cm)]
    _guard(story, st, "Key results", key_results)

    # ---- Site & climate ----
    def site():
        lat, lon = safe_float(assessment.latitude), safe_float(assessment.longitude)
        place = ", ".join(dict.fromkeys(p for p in (location.get("city"), location.get("district"), location.get("state")) if p))
        rain_basis = ""
        if location.get("rainfall_period"):
            rain_basis = f" (mean of {location.get('rainfall_period')}; {location.get('rainfall_source') or 'historical record'})"
        roof_note = "mapped on satellite imagery" if data.get("roof_polygon") else "entered by user"
        pairs = [
            ["Site name", safe_str(assessment.site_name)],
            ["Location", (place + "  |  " if place else "") + (f"{lat:.5f}, {lon:.5f}" if lat or lon else "N/A")],
            ["Roof area", f"{safe_float(assessment.roof_area):,.1f} m2 ({roof_note})"],
            ["Roof material / condition", f"{safe_str(assessment.roof_material).title()} / {safe_str(assessment.roof_condition).title()}"],
            ["Soil type", f"{safe_str(assessment.soil_type).title()} (infiltration ~{safe_float(recharge.get('infiltration_rate')):g} mm/h)"],
            ["Annual rainfall", f"{safe_float(assessment.annual_rainfall):,.0f} mm{rain_basis}"],
            ["Daily water demand", f"{safe_float(assessment.water_demand):,.0f} L/day"],
            ["Water tariff used", f"Rs. {safe_float(savings.get('water_tariff_used')):,.0f} per m3"],
        ]
        return [Paragraph("1. Site & Climate", st.h2), _kv_table(pairs, st)]
    _guard(story, st, "Site & climate", site)

    # ---- Hydrology & monthly yield ----
    def monthly():
        rain = hydrology.get("monthly_rainfall") or []
        harvest = hydrology.get("monthly_harvest") or []
        if len(rain) != 12:
            return []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        head = [Paragraph("", st.cell_head)] + [Paragraph(m, st.cell_head_right) for m in months]
        rows = [head,
                [Paragraph("Rain (mm)", st.cell)] + [Paragraph(f"{safe_float(v):,.0f}", st.cell_right) for v in rain]]
        if len(harvest) == 12:
            rows.append([Paragraph("Harvest (m3)", st.cell)] + [Paragraph(f"{safe_float(v):,.1f}", st.cell_right) for v in harvest])
        widths = [CONTENT_W * 0.16] + [CONTENT_W * 0.84 / 12] * 12
        notes = (f"Runoff coefficient {safe_float(hydrology.get('runoff_coefficient')):.2f} x condition factor "
                 f"{safe_float(hydrology.get('condition_factor')):.2f}; first-flush loss "
                 f"{safe_float(hydrology.get('first_flush_loss')):,.1f} m3/yr over ~{int(safe_float(hydrology.get('rain_events')))} rain events.")
        return [Paragraph("2. Monthly Rainfall & Harvest", st.h2), _table(rows, widths), Spacer(1, 3),
                Paragraph(clean(notes), st.small)]
    _guard(story, st, "Monthly rainfall", monthly)

    # ---- Recommendation dossier ----
    def recommendation():
        out = [Paragraph("3. Recommended System", st.h2)]
        chosen = next((d for d in dossiers if d.get("recommended")), None)
        if not chosen:
            label = RECOMMENDATION_LABELS.get(code, code.replace("_", " ").title())
            out.append(Paragraph(f"<b>{clean(label)}</b>", st.body))
            if code == "not_feasible":
                out.append(Paragraph("The roof yields too little water for a cost-effective system at this site.", st.body))
            return out
        suit = chosen.get("suitability") or {}
        out += [
            Paragraph(f"<b>{clean(chosen.get('title'))}</b>  -  suitability {int(safe_float(suit.get('score')))}/100 "
                      f"({clean(suit.get('label'))})", st.body),
            Spacer(1, 3),
            Paragraph(clean(chosen.get("description")), st.body),
            Paragraph(clean(chosen.get("mechanism")), st.body),
            Paragraph("Why this suits the site", st.h3),
            Paragraph(clean(chosen.get("justification")), st.body),
            Paragraph("Dimensions & capacity", st.h3),
            _kv_table([[d.get("label"), d.get("value")] for d in chosen.get("dimensions") or []], st),
        ]
        if chosen.get("bill_of_materials"):
            out += [Paragraph("Required materials", st.h3), _bullets(chosen["bill_of_materials"], st)]
        if chosen.get("installation_steps"):
            out += [Paragraph("Installation process", st.h3), _bullets(chosen["installation_steps"], st, ordered=True)]
        benefits = chosen.get("benefits") or {}
        if benefits.get("summary"):
            out += [Paragraph("Quantified benefits", st.h3), _bullets(benefits["summary"], st)]
        if chosen.get("maintenance"):
            out += [Paragraph("Maintenance protocol", st.h3), _bullets(chosen["maintenance"], st)]

        others = [d for d in dossiers if d is not chosen]
        if others:
            rows = [[Paragraph(h, st.cell_head) for h in ("Alternative", "Suitability")] +
                    [Paragraph("Est. cost", st.cell_head_right)]]
            for d in others:
                s = d.get("suitability") or {}
                rows.append([Paragraph(clean(d.get("title")), st.cell),
                             Paragraph(f"{int(safe_float(s.get('score')))}/100 - {clean(s.get('label'))}", st.cell),
                             Paragraph(rupees((d.get("financial") or {}).get("total_cost")), st.cell_right)])
            out += [Paragraph("Options compared", st.h3),
                    _table(rows, [CONTENT_W * 0.45, CONTENT_W * 0.33, CONTENT_W * 0.22])]
        return out
    _guard(story, st, "Recommended system", recommendation)

    # ---- Financial statement ----
    def financials():
        out = [Paragraph("4. Cost Estimation Statement", st.h2)]
        if not statement:
            costs = rec.get("cost_analysis") or rec.get("costs") or {}
            rows = [[Paragraph("Component", st.cell_head), Paragraph("Amount", st.cell_head_right)]]
            for key, value in costs.items():
                if key != "total_cost":
                    rows.append([Paragraph(clean(key.replace("_", " ").title()), st.cell), Paragraph(rupees(value), st.cell_right)])
            rows.append([Paragraph("<b>Total</b>", st.cell), Paragraph(f"<b>{rupees(costs.get('total_cost'))}</b>", st.cell_right)])
            return out + [_table(rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], total_rows=1)]

        def part(label: str, rows_in: List[Dict[str, Any]], subtotal_label: str, subtotal: Any):
            head = [Paragraph(h, st.cell_head) for h in ("S.No.", "Item description")] + \
                   [Paragraph(h, st.cell_head_right) for h in ("Quantity", "Unit price", "Amount")]
            rows = [head]
            for r in rows_in:
                rows.append([
                    Paragraph(str(r.get("sno", "")), st.cell),
                    Paragraph(clean(r.get("description")), st.cell),
                    Paragraph(clean(f"{safe_float(r.get('quantity')):g} {r.get('unit', '')}"), st.cell_right),
                    Paragraph(rupees(r.get("unit_price")), st.cell_right),
                    Paragraph(rupees(r.get("amount")), st.cell_right),
                ])
            if len(rows) == 1:
                rows.append([Paragraph("", st.cell), Paragraph("No items", st.cell), "", "", ""])
            rows.append([Paragraph("", st.cell), Paragraph(f"<b>{clean(subtotal_label)}</b>", st.cell), "", "",
                         Paragraph(f"<b>{rupees(subtotal)}</b>", st.cell_right)])
            widths = [CONTENT_W * w for w in (0.07, 0.45, 0.16, 0.15, 0.17)]
            return [Paragraph(label, st.h3), _table(rows, widths, total_rows=1)]

        out += part("Part A - Materials & Supplies", statement.get("materials") or [], "Materials subtotal (A)",
                    statement.get("materials_subtotal"))
        out += part("Part B - Additional Project Expenses", statement.get("additional") or [], "Additional costs subtotal (B)",
                    statement.get("additional_subtotal"))
        pct = round(safe_float(statement.get("contingency_rate")) * 100)
        summary = [
            ["Materials subtotal (A)", rupees(statement.get("materials_subtotal"))],
            ["+ Additional costs subtotal (B)", rupees(statement.get("additional_subtotal"))],
            [f"+ Contingency allowance ({pct}%)", rupees(statement.get("contingency"))],
            ["= Total estimated project cost (before subsidy)", rupees(statement.get("total_cost"))],
        ]
        rows = [[Paragraph(clean(k), st.cell), Paragraph(clean(v), st.cell_right)] for k, v in summary]
        rows[-1] = [Paragraph(f"<b>{clean(summary[-1][0])}</b>", st.cell), Paragraph(f"<b>{summary[-1][1]}</b>", st.cell_right)]
        out += [Paragraph("Part C - Estimated Gross Project Cost", st.h3),
                _table(rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], header=False, total_rows=1),
                Spacer(1, 3), Paragraph(clean(statement.get("rates_note")), st.small)]
        return out
    _guard(story, st, "Cost estimation statement", financials)

    # ---- Subsidies ----
    def subsidy_section():
        if not subsidies:
            return []
        out = [Paragraph("5. Government Subsidy Opportunities", st.h2)]
        rows = [[Paragraph(h, st.cell_head) for h in ("Scheme & authority", "Indicative assistance", "Eligibility & how to apply")]]
        for s in subsidies.get("schemes") or []:
            grant = safe_float(s.get("indicative_grant"))
            assistance = clean(s.get("assistance")) + (f"<br/><b>Up to {rupees(grant)} for this project</b>" if grant > 0 else "")
            rows.append([
                Paragraph(f"<b>{clean(s.get('name'))}</b><br/>{clean(authority_line(s))}", st.cell),
                Paragraph(assistance, st.cell),
                Paragraph(f"{clean(s.get('eligibility'))}<br/>{clean(s.get('how_to_apply'))}<br/>"
                          f"<font color='#0277B8'>{clean(s.get('portal'))}</font>", st.cell),
            ])
        out.append(_table(rows, [CONTENT_W * 0.3, CONTENT_W * 0.3, CONTENT_W * 0.4]))
        net = [
            ["Total estimated project cost", rupees(subsidies.get("gross_cost"))],
            ["- Indicative subsidy", rupees(subsidies.get("indicative_subsidy"))],
            ["= Indicative net project cost (projection)", rupees(subsidies.get("indicative_net_cost"))],
        ]
        net_rows = [[Paragraph(clean(k), st.cell), Paragraph(clean(v), st.cell_right)] for k, v in net]
        out += [Spacer(1, 6), KeepTogether([
            _table(net_rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], header=False, total_rows=1),
            Spacer(1, 4),
            Paragraph(f"<b>Disclaimer:</b> {clean(subsidies.get('disclaimer'))}",
                      ParagraphStyle("Disc", parent=st.small, textColor=AMBER)),
        ])]
        return out
    _guard(story, st, "Subsidies", subsidy_section)

    # ---- Safety ----
    def safety():
        checks = [c for c in (rec.get("safety_checks") or []) if isinstance(c, str) and c.strip()]
        if not checks:
            return []
        out = [Paragraph("6. Safety & Compliance", st.h2)]
        for check in checks:
            tag = check.split(":")[0].strip().upper()
            colour = RED if "CRITICAL" in tag else AMBER if "WARNING" in tag else GREEN if "REQUIRED" in tag else MUTED
            out.append(Paragraph(clean(check), ParagraphStyle("Chk", parent=st.body, textColor=colour, spaceAfter=3)))
        return out
    _guard(story, st, "Safety", safety)

    if not story:
        story.append(Paragraph("Assessment report: no data available.", st.body))

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=2.4 * cm, bottomMargin=1.9 * cm,
        title=f"Barkha.Ai Assessment - {safe_str(assessment.site_name, 'Site')}", author="Barkha.Ai",
    )
    decorate = lambda canvas, d: _page_decor(canvas, d, generated)  # noqa: E731
    try:
        doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    except Exception as e:
        logger.error(f"Error building PDF document: {e}", exc_info=True)
        raise ValueError(f"Failed to build PDF document: {e}")

    if not pdf_path.exists() or pdf_path.stat().st_size < 100:
        raise ValueError("Generated PDF is missing or empty")
    with open(pdf_path, "rb") as f:
        if not f.read(4).startswith(b"%PDF"):
            raise ValueError("Generated file is not a valid PDF")
    logger.info(f"PDF generated at {pdf_path} ({pdf_path.stat().st_size} bytes)")
    return str(pdf_path)
