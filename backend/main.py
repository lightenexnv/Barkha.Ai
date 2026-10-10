import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from core.config import CORS_ORIGINS
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
    # Browsers reject credentialed requests to a wildcard origin
    allow_credentials="*" not in CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/health")
async def health_check():
    database, error = "connected", None
    try:
        if mongo_client is None:
            raise RuntimeError(mongo_error)
        mongo_client.admin.command("ping")
    except Exception as e:
        database, error = "unreachable", str(e)[:300]
    return {"status": "healthy", "database": database, "database_error": error, "timestamp": datetime.now()}

@app.get("/")
async def root():
    return "Working!"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
