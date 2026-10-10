import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import redis
from pymongo import MongoClient

from core.config import DATABASE_URL, REDIS_URL, MONGODB_URL

logger = logging.getLogger(__name__)

# Database setup (PostgreSQL or SQLite fallback)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Safe Redis setup
class SafeRedis:
    def __init__(self, url):
        self._url = url
        self._client = None
        self._memory_cache = {}
        if url:
            try:
                self._client = redis.from_url(url, decode_responses=True)
            except Exception as e:
                logger.warning(f"Could not initialize Redis client: {e}")

    def setex(self, name, time, value):
        if self._client:
            try:
                return self._client.setex(name, time, value)
            except Exception as e:
                logger.warning(f"Redis setex failed ({e}), using memory fallback")
        self._memory_cache[name] = value

    def get(self, name):
        if self._client:
            try:
                return self._client.get(name)
            except Exception as e:
                logger.warning(f"Redis get failed ({e}), using memory fallback")
        return self._memory_cache.get(name)

    def __getattr__(self, name):
        if self._client:
            return getattr(self._client, name)
        raise AttributeError(f"'SafeRedis' object has no attribute '{name}'")

redis_client = SafeRedis(REDIS_URL)

# MongoDB setup
try:
    mongo_client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=2000) if MONGODB_URL else None
    mongo_db = mongo_client.rtrwh_offline if mongo_client else None
except Exception as e:
    logger.warning(f"Could not initialize MongoDB client: {e}")
    mongo_client = None
    mongo_db = None