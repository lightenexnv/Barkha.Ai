"""
Pre-filled subsidy application for a chosen scheme.

Builds a ready-to-print application letter addressed to the scheme's issuing
authority, filled from the assessment: applicant and property details, the
proposed system, the cost estimate, the assistance requested, the scheme's own
application steps, a document checklist, a declaration with signature lines
and, when the roof was mapped, a satellite image of the roof with its outline.
Fields the user did not provide are left as blanks to fill by hand.
"""
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer

from services.pdf_generator import (
    CONTENT_W, MARGIN, REPORTS_DIR, _kv_table, _page_decor, _Styles, authority_line, clean, rupees, safe_float, safe_str,
)

logger = logging.getLogger(__name__)

BLANK = "______________________________"
SYSTEM_TITLES = {
    "storage_only": "Rooftop rainwater storage tank",
    "recharge_only": "Groundwater recharge structure",
    "hybrid": "Rainwater storage tank with groundwater recharge",
    "storage_priority_hybrid": "Rainwater storage tank with groundwater recharge",
}

DOCUMENTS = [
    "Proof of ownership or occupancy of the property (sale deed, property tax receipt or allotment letter)",
    "Identity proof of the applicant (Aadhaar card or similar)",
    "Latest water or electricity bill for the property",
    "Photographs of the roof and the proposed site of the tank / pit",
    "Cost estimate (summarised in this application)",
    "Bank account details for any payment (cancelled cheque or passbook copy)",
]


def _roof_image(site: Dict[str, Any], out_dir: Path) -> Optional[Path]:
    """Satellite crop of the roof with its mapped outline, or None if unavailable."""
    polygon = site.get("roof_polygon") or []
    if len(polygon) < 3:
        return None
    try:
        from services import roof_detection as rd

        lat, lon = safe_float(site.get("latitude")), safe_float(site.get("longitude"))
        for zoom in (19, 18, 17):
            try:
                image, ox, oy = rd._mosaic(lat, lon, zoom)
                break
            except rd.RoofDetectionError:
                continue
        else:
            return None
        points = np.array([[rd._world_pixel(p[0], p[1], zoom)[0] - ox, rd._world_pixel(p[0], p[1], zoom)[1] - oy] for p in polygon], np.int32)
        overlay = image.copy()
        cv2.fillPoly(overlay, [points], (238, 211, 34))
        image = cv2.addWeighted(overlay, 0.25, image, 0.75, 0)
        cv2.polylines(image, [points], True, (238, 211, 34), 3)
        x, y, w, h = cv2.boundingRect(points)
        pad = max(w, h)
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(image.shape[1], x + w + pad), min(image.shape[0], y + h + pad)
        path = out_dir / f"roof_{uuid.uuid4().hex}.jpg"
        cv2.imwrite(str(path), image[y0:y1, x0:x1], [cv2.IMWRITE_JPEG_QUALITY, 82])
        return path
    except Exception as e:  # noqa: BLE001 - the image is optional
        logger.info(f"Roof image skipped: {e}")
        return None


def generate_application_pdf(site: Dict[str, Any], result: Dict[str, Any], scheme_id: str,
                             applicant: Dict[str, Any]) -> List[str]:
    """Build the application PDF; returns [pdf_path, *temporary files to delete]."""
    subsidies = result.get("subsidies") or {}
    scheme = next((s for s in subsidies.get("schemes") or [] if s.get("id") == scheme_id), None)
    if scheme is None:
        raise ValueError("Unknown scheme for this assessment")

    REPORTS_DIR.mkdir(exist_ok=True)
    pdf_path = REPORTS_DIR / f"application_{scheme_id}_{uuid.uuid4().hex}.pdf"
    temp_files: List[str] = []
    st = _Styles()
    generated = datetime.now().strftime("%d %b %Y")

    statement = result.get("financial_statement") or {}
    total = safe_float(statement.get("total_cost"), safe_float((result.get("cost_analysis") or {}).get("total_cost")))
    grant = safe_float(scheme.get("indicative_grant"))
    storage = result.get("storage_recommendation") or {}
    recommended = next((d for d in result.get("dossiers") or [] if d.get("recommended")), None)
    system = (recommended or {}).get("title") or SYSTEM_TITLES.get(result.get("recommended_option", ""), "Rooftop rainwater harvesting system")
    place = ", ".join(dict.fromkeys(p for p in (site.get("city"), site.get("district"), site.get("state")) if p))

    name = safe_str(applicant.get("name"), BLANK)
    story: List[Any] = [
        Paragraph(f"Date: {generated}", st.body),
        Spacer(1, 8),
        Paragraph("To,", st.body),
        Paragraph(f"<b>{clean(authority_line(scheme))}</b>", st.body),
        Spacer(1, 10),
        Paragraph(f"<b>Subject: Application for assistance under “{clean(scheme.get('name'))}” for a rooftop "
                  f"rainwater harvesting system</b>", st.body),
        Spacer(1, 10),
        Paragraph("Respected Sir / Madam,", st.body),
        Spacer(1, 4),
        Paragraph(
            clean(
                f"I, {name if name != BLANK else '________________'}, wish to install a {system.lower()} at the property described "
                f"below and request assistance under the above scheme. The details of the property, the proposed system "
                f"and its estimated cost are given below for your kind consideration."
            ),
            st.body,
        ),
        Paragraph("1. Applicant", st.h2),
        _kv_table([
            ["Name", name],
            ["Mobile number", safe_str(applicant.get("phone"), BLANK)],
            ["Email", safe_str(applicant.get("email"), BLANK)],
            ["Postal address", safe_str(applicant.get("address"), BLANK)],
        ], st),
        Paragraph("2. Property", st.h2),
        _kv_table([
            ["Site", safe_str(site.get("site_name"))],
            ["Location", (place + "  |  " if place else "") + f"{safe_float(site.get('latitude')):.5f}, {safe_float(site.get('longitude')):.5f}"],
            ["Roof area", f"{safe_float(site.get('roof_area')):,.0f} m2 ({'mapped on satellite imagery' if site.get('roof_polygon') else 'stated by applicant'})"],
            ["Roof type", safe_str(site.get("roof_material")).title()],
            ["People using water", f"about {round(safe_float(site.get('water_demand')) / 135)} (≈ {safe_float(site.get('water_demand')):,.0f} litres a day)"],
            ["Average rainfall", f"{safe_float(site.get('annual_rainfall')):,.0f} mm a year"],
        ], st),
        Paragraph("3. Proposed system", st.h2),
        _kv_table(
            [["System", system]]
            + [[d.get("label"), d.get("value")] for d in (recommended or {}).get("dimensions") or []]
            + [["Rainwater collected", f"about {safe_float(result.get('harvestable_volume')) * 1000:,.0f} litres a year"]],
            st,
        ),
        Paragraph("4. Cost and assistance requested", st.h2),
        _kv_table([
            ["Materials", rupees(statement.get("materials_subtotal"))],
            ["Labour and civil work", rupees(statement.get("additional_subtotal"))],
            ["Contingency", rupees(statement.get("contingency"))],
            ["Total estimated cost", rupees(total)],
            ["Assistance requested", rupees(grant) if grant > 0 else "As admissible under the scheme"],
            ["Applicant's share", rupees(max(0.0, total - grant)) if grant > 0 else "Balance of the cost"],
        ], st),
        Spacer(1, 3),
        Paragraph(clean(f"Scheme benefit: {scheme.get('assistance')}"), st.small),
    ]

    image_path = _roof_image(site, REPORTS_DIR)
    if image_path:
        temp_files.append(str(image_path))
        img = Image(str(image_path))
        scale = min(CONTENT_W * 0.6 / img.imageWidth, 7 * cm / img.imageHeight)
        img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
        story += [Paragraph("5. Roof (satellite view)", st.h2), img,
                  Paragraph("Outline of the roof that will collect rainwater (Esri World Imagery).", st.small)]

    n = 6 if image_path else 5
    story += [
        Paragraph(f"{n}. How to apply", st.h2),
        Paragraph(clean(scheme.get("how_to_apply")), st.body),
        Paragraph(clean(f"Eligibility: {scheme.get('eligibility')}"), st.small),
        Paragraph(f"Official website: <font color='#0277B8'>{clean(scheme.get('portal'))}</font>", st.small),
        Paragraph(f"{n + 1}. Documents enclosed (tick)", st.h2),
        *[Paragraph(f"[&nbsp;&nbsp;]&nbsp;&nbsp;{clean(d)}", st.body) for d in DOCUMENTS],
        KeepTogether([
            Paragraph(f"{n + 2}. Declaration", st.h2),
            Paragraph(
                "I declare that the information given above is true to the best of my knowledge. I will install and "
                "maintain the rainwater harvesting system as approved, allow inspection by the authority, and abide by "
                "the terms of the scheme. I understand that the assistance is subject to verification and approval.",
                st.body,
            ),
            Spacer(1, 26),
            Paragraph(f"Signature of applicant: {BLANK}", st.body),
            Spacer(1, 8),
            Paragraph(f"Name: {name}" + "&nbsp;" * 10 + f"Place: {clean(site.get('city') or BLANK)}" + "&nbsp;" * 10 + f"Date: {generated}", st.body),
        ]),
        Spacer(1, 12),
        Paragraph(
            "Prepared with Barkha.Ai. Amounts are indicative estimates; the authority decides eligibility and the "
            "final amount of any assistance.",
            st.small,
        ),
    ]

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=2.4 * cm, bottomMargin=1.9 * cm,
        title=f"Subsidy application - {safe_str(scheme.get('name'))}", author="Barkha.Ai",
    )
    stamp = datetime.now().strftime("%d %b %Y, %H:%M")
    doc.build(story, onFirstPage=lambda c, d: _page_decor(c, d, stamp), onLaterPages=lambda c, d: _page_decor(c, d, stamp))
    return [str(pdf_path), *temp_files]

