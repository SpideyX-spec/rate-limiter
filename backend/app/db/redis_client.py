import logging
import redis.asyncio as aioredis
from redis.exceptions import RedisError

try:
    from app.config import REDIS_URL
except ImportError:
    from ..config import REDIS_URL

logger = logging.getLogger(__name__)

# Initialize async Redis client using REDIS_URL from config.py
# Use 5s timeout to support reliable cloud Redis connections
redis_client: aioredis.Redis = aioredis.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=5.0,
    socket_timeout=5.0,
)


async def check_redis_health() -> bool:
    """
    Pings Redis and returns True if healthy, or False if connection fails
    without raising an unhandled exception.
    """
    try:
        response = await redis_client.ping()
        return bool(response)
    except (RedisError, ConnectionRefusedError, TimeoutError, OSError, Exception) as exc:
        logger.warning("Redis health check failed: %s", exc)
        return False


async def get_redis_client() -> aioredis.Redis:
    """Returns the reusable async Redis client instance."""
    return redis_client


async def close_redis_client() -> None:
    """Closes the Redis client connection pool."""
    try:
        if hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        else:
            await redis_client.close()
    except Exception as exc:
        logger.warning("Error closing Redis client: %s", exc)
