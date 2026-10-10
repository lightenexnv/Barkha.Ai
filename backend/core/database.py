import logging
import redis
from pymongo import MongoClient

from core.config import REDIS_URL, MONGODB_URL, MONGODB_DB_NAME

logger = logging.getLogger(__name__)

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

# MongoDB setup (primary data store). A bad URL must not crash startup,
# otherwise Render only shows a 502 and /health can't report the cause.
mongo_error = None
try:
    mongo_client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000, tz_aware=False)
    mongo_db = mongo_client[MONGODB_DB_NAME]
except Exception as e:
    logger.error(f"Could not initialize MongoDB client: {e}")
    mongo_error = str(e)
    mongo_client = None
    mongo_db = None
