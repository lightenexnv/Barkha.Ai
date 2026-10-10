import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from backend directory, then parent directory if present
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv()

# Redis is optional: an empty REDIS_URL uses the in-memory fallback
REDIS_URL = os.getenv("REDIS_URL", "")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "barkha_ai")

# Comma-separated list of allowed frontend origins, e.g. https://barkha-ai.vercel.app
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
