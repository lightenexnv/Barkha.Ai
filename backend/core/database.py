import logging
import time

import redis
from pymongo import MongoClient

from core.config import REDIS_URL, MONGODB_URL, MONGODB_DB_NAME

logger = logging.getLogger(__name__)

# Safe Redis setup. When Redis is unreachable, every call would otherwise wait
# for a connection timeout (seconds on Windows), so failures open a short
# circuit breaker and the in-memory cache serves in the meantime.
RETRY_AFTER_SECONDS = 60


class SafeRedis:
    def __init__(self, url):
        self._url = url
        self._client = None
        self._memory_cache = {}
        self._down_until = 0.0
        if url:
            try:
                self._client = redis.from_url(
                    url, decode_responses=True, socket_connect_timeout=1, socket_timeout=2
                )
            except Exception as e:
                logger.warning(f"Could not initialize Redis client: {e}")

    def _available(self) -> bool:
        return self._client is not None and time.monotonic() >= self._down_until

    def _failed(self, action: str, error: Exception) -> None:
        self._down_until = time.monotonic() + RETRY_AFTER_SECONDS
        logger.warning(f"Redis {action} failed ({error}); using memory cache for {RETRY_AFTER_SECONDS}s")

    def setex(self, name, time_, value):
        # Always keep a local copy so lookups survive a Redis outage
        self._memory_cache[name] = value
        if self._available():
            try:
                return self._client.setex(name, time_, value)
            except Exception as e:
                self._failed("setex", e)

    def get(self, name):
        if self._available():
            try:
                value = self._client.get(name)
                if value is not None:
                    return value
            except Exception as e:
                self._failed("get", e)
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
