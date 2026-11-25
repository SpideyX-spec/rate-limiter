# Sliding Window Rate Limiter

A real-time rate limiter built with **FastAPI**, **Redis Sorted Sets (ZSET)**, and a dark-mode **React + Vite** dashboard.

---

## 1. Sliding Window Log Algorithm

Unlike fixed-window counters that allow up to 2x traffic bursts at window boundaries, the **Sliding Window Log** algorithm maintains an exact timestamped log of each client's requests within a continuous rolling window `[now - window, now]`.

On every request to protected routes (`/api/data`), an atomic Redis pipeline executes:
1. **`ZREMRANGEBYSCORE key 0 (now - window)`**: Evicts timestamps older than the active window.
2. **`ZADD key now now`**: Records the current request timestamp with score and member both set to current Unix epoch time.
3. **`ZCARD key`**: Counts the total requests within the active window.
4. **`EXPIRE key window`**: Refreshes key TTL so inactive client logs automatically expire.

### Decision & Headers
- If `ZCARD <= limit`: The request is allowed (`200 OK`).
- If `ZCARD > limit`: The request is short-circuited with `429 Too Many Requests`.
- **Reset In (`reset_in`)**: Calculated from the oldest timestamp in the sorted set via `ZRANGE key 0 0 WITHSCORES`:
  $$\text{reset\_in} = \max\left(0, \lceil \text{oldest\_timestamp} + \text{window} - \text{now} \rceil\right)$$
  Exposed to callers via `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`.

---

## 2. Why Redis (Key-Value / Sorted Sets)?

- **In-Memory Sub-Millisecond Speed**: Rate limiting is in the critical synchronous path of every request; Redis delivers sub-millisecond execution.
- **Logarithmic Timestamp Pruning ($O(\log N + M)$)**: Redis Sorted Sets naturally index items by score (Unix time), making range deletions (`ZREMRANGEBYSCORE`) and cardinality checks (`ZCARD`, $O(1)$) extremely fast.
- **Atomic Pipelines**: The `MULTI/EXEC` pipeline executes the eviction, insertion, count, and TTL in a single atomic roundtrip, preventing race conditions without heavy distributed locks.
- **Automated Memory Reclamation**: Redis key-level `EXPIRE` ensures idle client keys (`rate_limit:{client_id}:{endpoint}`) are evicted without background cleanup cron jobs.
- **Stateless App Tier**: Centralizing state in Redis allows horizontal scaling across multiple FastAPI workers/instances.

---

## 3. Local Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.10+
- Node.js 18+

### Step 1: Start Redis
```bash
docker compose up -d
```

### Step 2: Run the Backend
```bash
cd backend
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`

### Step 3: Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
- Dashboard: `http://localhost:5173`

---

## 4. Render Deployment Architecture

The application is configured for Infrastructure-as-Code deployment via the root [`render.yaml`](./render.yaml) blueprint:

```
                    ┌────────────────────────┐
                    │   Browser / Client     │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ rate-limiter-frontend        │        │ rate-limiter-backend         │
│ (Render Static Site)         │        │ (Render Python Web Service)  │
│ - SPA built from frontend/   ├───────►│ - FastAPI on Uvicorn         │
│ - Distributes static assets  │        │ - Reads REDIS_URL            │
└──────────────────────────────┘        └──────────────┬───────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │ Redis Instance               │
                                        │ (Render Redis or Upstash)    │
                                        └──────────────────────────────┘
```

- **`rate-limiter-backend`** (Python Web Service):
  - Root: `backend`
  - Build: `pip install -r requirements.txt`
  - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Required Environment Variable: `REDIS_URL` (e.g. from Render Redis or Upstash Redis) and `ALLOWED_ORIGINS` (pointing to the frontend URL).
- **`rate-limiter-frontend`** (Static Site):
  - Root: `frontend`
  - Build: `npm install && npm run build`
  - Publish Directory: `dist`
  - Environment Variable: `VITE_API_BASE_URL` (pointing to the backend service URL).
