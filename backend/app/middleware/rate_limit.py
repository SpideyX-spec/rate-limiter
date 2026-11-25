import logging
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

try:
    from app.core.limiter import SlidingWindowRateLimiter
except ImportError:
    from ..core.limiter import SlidingWindowRateLimiter

logger = logging.getLogger(__name__)


def get_client_identifier(request: Request) -> str:
    """
    Extracts client ID from the X-Client-ID header, falling back to
    forwarded headers or direct client IP.
    """
    custom_client_id = request.headers.get("x-client-id") or request.headers.get(
        "X-Client-ID"
    )
    if custom_client_id:
        return custom_client_id.strip()

    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that intercepts /api/data and applies sliding window rate limiting.
    """

    def __init__(self, app, limiter: Optional[SlidingWindowRateLimiter] = None):
        super().__init__(app)
        self.limiter = limiter or SlidingWindowRateLimiter()
        self.target_endpoint = "/api/data"

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Only intercept /api/data
        normalized_path = request.url.path.rstrip("/")
        if normalized_path != self.target_endpoint:
            return await call_next(request)

        client_id = get_client_identifier(request)

        try:
            rate_info = await self.limiter.is_allowed(
                client_id=client_id,
                endpoint=self.target_endpoint,
            )
        except Exception as exc:
            # Gracefully handle Redis connection failure so the app does not crash
            logger.warning("Rate limiter unavailable, bypassing limit: %s", exc)
            return await call_next(request)

        allowed: bool = rate_info["allowed"]
        limit: int = rate_info["limit"]
        remaining: int = rate_info["remaining"]
        reset_in: int = rate_info["reset_in"]

        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_in),
        }

        # Return HTTP 429 Too Many Requests if allowed is False
        if not allowed:
            headers["Retry-After"] = str(reset_in)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too Many Requests",
                    "retry_after": reset_in,
                },
                headers=headers,
            )

        # Attach rate limit headers to the successful response
        response = await call_next(request)
        for header_name, header_value in headers.items():
            response.headers[header_name] = header_value

        return response
