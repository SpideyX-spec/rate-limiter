from datetime import datetime, timezone
from fastapi import APIRouter, Request

try:
    from app.db.redis_client import check_redis_health, redis_client
    from app.middleware.rate_limit import get_client_identifier
except ImportError:
    from ..db.redis_client import check_redis_health, redis_client
    from ..middleware.rate_limit import get_client_identifier

router = APIRouter()


@router.get("/api/data")
async def get_data():
    """Returns a JSON object with a success message and current ISO timestamp."""
    return {
        "message": "Success! You have accessed the protected endpoint.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/api/health")
async def get_health():
    """Calls check_redis_health() and returns {"status": "ok", "redis": bool}."""
    is_healthy = await check_redis_health()
    return {
        "status": "ok",
        "redis": is_healthy,
    }


@router.post("/api/reset")
async def reset_rate_limit(request: Request):
    """Deletes the caller's Redis key (rate_limit:{client_id}:/api/data) and returns {"reset": true}."""
    client_id = get_client_identifier(request)
    key = f"rate_limit:{client_id}:/api/data"
    try:
        await redis_client.delete(key)
    except Exception:
        pass
    return {
        "reset": True,
    }
