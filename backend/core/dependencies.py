# app/core/dependencies.py
from core.database import mongo_db

def get_db():
    return mongo_db
