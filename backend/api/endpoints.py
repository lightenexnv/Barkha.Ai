# app/api/endpoints.py
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pymongo.database import Database
from typing import Any, List, Dict
import json
import os
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime
import logging
from core.database import redis_client, mongo_db
from core.dependencies import get_db
from models.db_models import Assessment, LocalConfig
from models.pydantic_models import SiteDetailsInput, AssessmentResult, ConfigData, DirectReportRequest, RoofDetectionRequest, SubsidyApplicationRequest
from services.application_generator import generate_application_pdf
from services.calculator import RTRWHCalculator
from services.pdf_generator import generate_assessment_pdf
from services.text_generator import generate_assessment_text
from services.roof_detection import detect_roof, RoofDetectionError
from starlette.concurrency import run_in_threadpool
from typing import Optional



router = APIRouter()
calculator = RTRWHCalculator()
logger = logging.getLogger(__name__)

DEFAULT_WATER_TARIFF = 50  # ₹ per m³
# Assessments are also cached so reports still work when MongoDB is unreachable
ASSESSMENT_CACHE_TTL = 30 * 24 * 3600


def get_optional_db() -> Optional[Database]:
    """Like get_db, but lets the endpoint run without MongoDB."""
    return mongo_db


def _cache_key(assessment_id: str) -> str:
    return f"assessment:{assessment_id}"


def save_assessment(db: Optional[Database], assessment: Assessment,
                    background: Optional[BackgroundTasks] = None) -> None:
    """Cache now (so reports work immediately); store in MongoDB after the response if possible."""
    try:
        redis_client.setex(_cache_key(assessment.id), ASSESSMENT_CACHE_TTL, json.dumps(assessment.to_doc(), default=str))
    except Exception as e:
        logger.warning(f"Could not cache assessment {assessment.id}: {e}")
    if db is None:
        return
    if background is not None:
        # An unreachable MongoDB can take seconds to time out; don't make the user wait for it
        background.add_task(_store_assessment, db, assessment)
    else:
        _store_assessment(db, assessment)


def _store_assessment(db: Database, assessment: Assessment) -> None:
    try:
        db.assessments.insert_one(assessment.to_doc())
    except Exception as e:
        # The result is still returned and cached; only long-term storage is lost
        logger.warning(f"Could not store assessment {assessment.id} in MongoDB: {e}")


def find_assessment(db: Optional[Database], assessment_id: str) -> Optional[Assessment]:
    if db is not None:
        try:
            doc = db.assessments.find_one({"_id": assessment_id})
            if doc:
                return Assessment.from_doc(doc)
        except Exception as e:
            logger.warning(f"MongoDB lookup for assessment {assessment_id} failed: {e}")
    try:
        cached = redis_client.get(_cache_key(assessment_id))
        if cached:
            doc = json.loads(cached)
            # Older cache entries hold the API result, not the stored record
            if "_id" in doc:
                return Assessment.from_doc(doc)
    except Exception as e:
        logger.warning(f"Cache lookup for assessment {assessment_id} failed: {e}")
    return None


def run_assessment(site_data: SiteDetailsInput, roof_area: float) -> Dict[str, Any]:
    """Run the full calculation and return it in the AssessmentResult shape."""
    return calculator.assess({**site_data.model_dump(), "roof_area": roof_area}, default_tariff=DEFAULT_WATER_TARIFF)


def build_assessment(site: Dict[str, Any], result: Dict[str, Any], assessment_id: Optional[str] = None,
                     extra_data: Optional[Dict[str, Any]] = None) -> Assessment:
    """Build a record whose keys match what the PDF and text generators read."""
    assessment_data = {
        "harvestable_volume": result.get("harvestable_volume"),
        "storage_recommendation": result.get("storage_recommendation") or {},
        "recharge_recommendation": result.get("recharge_recommendation") or {},
        "financial_statement": result.get("financial_statement"),
        "subsidies": result.get("subsidies"),
        "dossiers": result.get("dossiers"),
        "hydrology": result.get("hydrology"),
        "location": {key: site.get(key) for key in ("city", "district", "state", "rainfall_source", "rainfall_period")},
        "roof_polygon": site.get("roof_polygon"),
        **(extra_data or {}),
    }
    recommendations = {
        key: result.get(key)
        for key in ("recommended_option", "cost_analysis", "savings_analysis",
                    "bill_of_quantities", "safety_checks", "payback_period")
    }
    return Assessment(
        id=assessment_id,
        site_name=site.get("site_name"), latitude=site.get("latitude"), longitude=site.get("longitude"),
        roof_area=site.get("roof_area"), roof_material=site.get("roof_material"),
        roof_condition=site.get("roof_condition") or "good", soil_type=site.get("soil_type"),
        annual_rainfall=site.get("annual_rainfall"), water_demand=site.get("water_demand"),
        assessment_data=assessment_data, recommendations=recommendations,
    )


@router.post("/assess", response_model=AssessmentResult)
async def create_assessment(site_data: SiteDetailsInput, background: BackgroundTasks,
                            db: Optional[Database] = Depends(get_optional_db)):
    logging.info(f"Received site_data: {site_data.model_dump()}")
    result = run_assessment(site_data, site_data.roof_area)
    assessment = build_assessment(site_data.model_dump(), result)
    save_assessment(db, assessment, background)
    return AssessmentResult(assessment_id=assessment.id, **result)

@router.get("/assessments")
async def get_assessments(skip: int = 0, limit: int = 100, db: Database = Depends(get_db)):
    docs = db.assessments.find().sort("created_at", -1).skip(skip).limit(limit)
    return [Assessment.from_doc(doc).to_dict() for doc in docs]

@router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str, db: Optional[Database] = Depends(get_optional_db)):
    assessment = await run_in_threadpool(find_assessment, db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment.to_dict()

@router.post("/config")
async def update_config(config: ConfigData, db: Database = Depends(get_db)):
    local_config = LocalConfig(
        region=config.region, rainfall_data=config.rainfall_data,
        soil_data=config.soil_data, cost_data=config.cost_data, tariff_data=config.tariff_data
    )
    db.local_configs.insert_one(local_config.to_doc())
    redis_client.setex(f"config:{config.region}", 86400, json.dumps(config.model_dump()))
    return {"message": "Configuration updated successfully"}


def _report_name(assessment: Assessment, prefix: str, extension: str) -> str:
    name = f"{prefix}_{assessment.site_name or 'Site'}_{str(assessment.id)[:8]}.{extension}"
    # Remove any problematic characters from filename
    return "".join(c for c in name if c.isalnum() or c in (' ', '-', '_', '.')).strip()


async def serve_report(assessment: Assessment, report_format: str) -> FileResponse:
    """Generate a PDF, TXT or ZIP (both) report and stream it as a download."""
    temp_files: List[Path] = []

    async def cleanup():
        for path in temp_files:
            try:
                if path.exists():
                    path.unlink()
            except Exception as e:
                logger.warning(f"Failed to clean up {path}: {e}")

    try:
        if report_format == "pdf":
            path = Path(await generate_assessment_pdf(assessment))
            temp_files.append(path)
            media_type, filename = "application/pdf", _report_name(assessment, "RTRWH_Assessment", "pdf")
        elif report_format == "txt":
            path = Path(await generate_assessment_text(assessment))
            temp_files.append(path)
            media_type, filename = "text/plain; charset=utf-8", _report_name(assessment, "RTRWH_Assessment", "txt")
        else:
            pdf_path = Path(await generate_assessment_pdf(assessment))
            temp_files.append(pdf_path)
            txt_path = Path(await generate_assessment_text(assessment))
            temp_files.append(txt_path)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip:
                path = Path(temp_zip.name)
            temp_files.append(path)
            with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(pdf_path, _report_name(assessment, "RTRWH_Assessment", "pdf"))
                zipf.write(txt_path, _report_name(assessment, "RTRWH_Assessment", "txt"))
            media_type, filename = "application/zip", _report_name(assessment, "RTRWH_Reports", "zip")

        if not path.exists() or path.stat().st_size == 0:
            raise RuntimeError("Generated report file is empty")
    except Exception as e:
        await cleanup()
        logger.error(f"Report generation failed for assessment {assessment.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")

    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=filename,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        },
        background=cleanup  # Delete the files after the response is sent
    )


async def _report_for_id(db: Optional[Database], assessment_id: str, report_format: str) -> FileResponse:
    # MongoDB calls are blocking; keep them off the event loop
    assessment = await run_in_threadpool(find_assessment, db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found on the server. Send its data to /api/generate-report-direct instead."
        )
    return await serve_report(assessment, report_format)


@router.get("/generate-report/{assessment_id}")
async def generate_pdf_report(assessment_id: str, db: Optional[Database] = Depends(get_optional_db)):
    return await _report_for_id(db, assessment_id, "pdf")


@router.get("/generate-text-report/{assessment_id}")
async def generate_text_report(assessment_id: str, db: Optional[Database] = Depends(get_optional_db)):
    return await _report_for_id(db, assessment_id, "txt")


@router.get("/download-reports/{assessment_id}")
async def download_both_reports(assessment_id: str, db: Optional[Database] = Depends(get_optional_db)):
    """Returns a ZIP file containing both the PDF and TXT reports."""
    return await _report_for_id(db, assessment_id, "zip")


@router.post("/generate-report-direct")
async def generate_report_direct(request: DirectReportRequest):
    """
    Build a report from assessment data sent by the client, for assessments the
    server no longer has (guest sessions, saved history, MongoDB outages).
    """
    assessment = build_assessment(request.site, request.result, assessment_id=request.result.get("assessment_id"))
    return await serve_report(assessment, request.format)


@router.post("/subsidy-application")
async def subsidy_application(request: SubsidyApplicationRequest):
    """A pre-filled, ready-to-print application for one subsidy scheme."""
    try:
        files = await run_in_threadpool(generate_application_pdf, request.site, request.result, request.scheme_id, request.applicant)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Subsidy application failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="The application form could not be prepared.")

    async def cleanup():
        for name in files:
            try:
                Path(name).unlink(missing_ok=True)
            except Exception as error:
                logger.warning(f"Could not delete {name}: {error}")

    scheme = "".join(c for c in request.scheme_id if c.isalnum() or c in "-_")
    filename = f"Subsidy_Application_{scheme}.pdf"
    return FileResponse(
        files[0], media_type="application/pdf", filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
        background=cleanup,
    )


@router.post("/upload-photos/{assessment_id}")
async def upload_site_photos(assessment_id: str, files: List[UploadFile] = File(...), db: Database = Depends(get_db)):
    assessment = find_assessment(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    photo_paths = []
    upload_dir = Path("uploads") / str(assessment_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        photo_paths.append(str(file_path))
    
    db.assessments.update_one(
        {"_id": assessment.id},
        {"$set": {"site_photos": photo_paths, "updated_at": datetime.now()}}
    )
    return {"message": f"Uploaded {len(files)} photos successfully"}

@router.get("/offline-sync")
async def sync_offline_data(db: Database = Depends(get_db)):
    result = db.assessments.update_many({"is_synced": False}, {"$set": {"is_synced": True}})
    return {"message": f"Synced {result.modified_count} offline assessments"}


@router.post("/detect-roof")
async def detect_roof_at_pin(request: RoofDetectionRequest):
    """Segment the roof under a pinned point and return its outline and ground area."""
    try:
        return await run_in_threadpool(detect_roof, request.latitude, request.longitude)
    except RoofDetectionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Roof detection failed at {request.latitude}, {request.longitude}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Roof detection failed. Try re-pinning or trace the roof manually.")
