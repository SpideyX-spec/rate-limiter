import sys
from pathlib import Path

# Ensure backend directory is in sys.path so 'app' imports always resolve cleanly
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.config import ALLOWED_ORIGINS
    from app.db.redis_client import close_redis_client
    from app.middleware.rate_limit import RateLimitMiddleware
    from app.routes.api import router as api_router
except ImportError:
    from .config import ALLOWED_ORIGINS
    from .db.redis_client import close_redis_client
    from .middleware.rate_limit import RateLimitMiddleware
    from .routes.api import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown: gracefully close Redis connections
    await close_redis_client()


app = FastAPI(
    title="Sliding Window Rate Limiter API",
    version="1.0.0",
    lifespan=lifespan,
)

# 1. Register Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# 2. Configure CORSMiddleware (outermost so CORS headers apply to all responses, including 429)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

# 3. Include API Router
app.include_router(api_router)
