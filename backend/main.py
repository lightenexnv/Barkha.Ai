import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from core.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from core.database import mongo_client, mongo_db, mongo_error
from api.endpoints import router as api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="RTRWH Assessment API",
    description="API for Rooftop Rainwater Harvesting Assessment",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    # Browsers reject credentialed requests to a wildcard origin
    allow_credentials="*" not in CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the cross-origin frontend read the report filename
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix="/api")

@app.on_event("startup")
def create_indexes():
    if mongo_db is None:
        return
    try:
        mongo_db.assessments.create_index("created_at")
        mongo_db.assessments.create_index("is_synced")
    except Exception as e:
        logger.warning(f"Could not create MongoDB indexes: {e}")

_db_status = {"checked": 0.0, "database": "unknown", "error": None}


@app.get("/health")
def health_check():
    # A plain (threadpool) handler: the MongoDB ping blocks for up to the
    # server-selection timeout when the database is unreachable, and inside an
    # async handler that would freeze every other request. The result is
    # cached so frequent health checks do not each wait for it.
    if time.monotonic() - _db_status["checked"] > 30:
        database, error = "connected", None
        try:
            if mongo_client is None:
                raise RuntimeError(mongo_error)
            mongo_client.admin.command("ping")
        except Exception as e:
            database, error = "unreachable", str(e)[:300]
        _db_status.update(checked=time.monotonic(), database=database, error=error)
    return {"status": "healthy", "database": _db_status["database"], "database_error": _db_status["error"], "timestamp": datetime.now()}

@app.get("/")
async def root():
    return "Working!"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
