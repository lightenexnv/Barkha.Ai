# app/core/dependencies.py
from fastapi import HTTPException
from core.database import mongo_db, mongo_error

def get_db():
    if mongo_db is None:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {mongo_error}")
    return mongo_db
