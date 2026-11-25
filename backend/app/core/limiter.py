import math
import time
from typing import Any, Dict, Optional
import redis.asyncio as aioredis

try:
    from app.config import RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS
    from app.db.redis_client import redis_client as default_redis_client
except ImportError:
    from ..config import RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS
    from ..db.redis_client import redis_client as default_redis_client


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter using Redis Sorted Sets (ZSET).
    """

    def __init__(
        self,
        redis_client: Optional[aioredis.Redis] = None,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ):
        self.redis = redis_client if redis_client is not None else default_redis_client
        self.max_requests = (
            max_requests if max_requests is not None else RATE_LIMIT_MAX_REQUESTS
        )
        self.window_seconds = (
            window_seconds if window_seconds is not None else RATE_LIMIT_WINDOW_SECONDS
        )

    async def is_allowed(
        self,
        client_id: str,
        endpoint: str,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates whether a request from client_id to endpoint is allowed.

        Returns:
            dict: {"allowed": bool, "limit": int, "remaining": int, "reset_in": int}
        """
        limit = max_requests if max_requests is not None else self.max_requests
        window = window_seconds if window_seconds is not None else self.window_seconds

        key = f"rate_limit:{client_id}:{endpoint}"
        now = time.time()
        clear_before = now - window

        # Atomic pipeline executing sorted set operations
        pipe = self.redis.pipeline(transaction=True)
        pipe.zremrangebyscore(key, 0, clear_before)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window)
        results = await pipe.execute()

        current_requests: int = int(results[2])
        allowed: bool = current_requests <= limit
        remaining: int = max(0, limit - current_requests)

        # Calculate time until the oldest timestamp in the current window expires
        try:
            oldest_entries = await self.redis.zrange(key, 0, 0, withscores=True)
            if oldest_entries:
                oldest_ts = float(oldest_entries[0][1])
                reset_in = max(0, int(math.ceil(oldest_ts + window - now)))
            else:
                reset_in = window
        except Exception:
            reset_in = window

        return {
            "allowed": allowed,
            "limit": limit,
            "remaining": remaining,
            "reset_in": reset_in,
        }

    async def check_rate_limit(
        self,
        client_id: str,
        endpoint: str,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Alias for is_allowed."""
        return await self.is_allowed(
            client_id=client_id,
            endpoint=endpoint,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

    async def __call__(
        self,
        client_id: str,
        endpoint: str,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Callable interface delegating to is_allowed."""
        return await self.is_allowed(
            client_id=client_id,
            endpoint=endpoint,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
