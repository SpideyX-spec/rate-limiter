const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Fetches the rate-limited protected endpoint (/api/data).
 *
 * @param {string} [clientId] - Client identifier sent via X-Client-ID header.
 * @returns {Promise<{
 *   status: number,
 *   data: any,
 *   limit: number | null,
 *   remaining: number | null,
 *   reset: number | null,
 *   resetIn: number | null,
 *   retryAfter: number | null
 * }>}
 */
export async function fetchProtectedData(clientId) {
  const headers = {};
  if (clientId) {
    headers['X-Client-ID'] = clientId;
  }

  const response = await fetch(`${BASE_URL}/api/data`, {
    method: 'GET',
    headers,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = { error: 'Failed to parse JSON response' };
  }

  const limitHeader = response.headers.get('x-ratelimit-limit');
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const resetHeader = response.headers.get('x-ratelimit-reset');
  const retryAfterHeader = response.headers.get('retry-after');

  const limit = limitHeader !== null ? parseInt(limitHeader, 10) : null;
  const remaining = remainingHeader !== null ? parseInt(remainingHeader, 10) : null;
  const reset = resetHeader !== null
    ? parseInt(resetHeader, 10)
    : (retryAfterHeader !== null ? parseInt(retryAfterHeader, 10) : null);

  return {
    status: response.status,
    data,
    limit,
    remaining,
    reset,
    resetIn: reset,
    retryAfter: retryAfterHeader !== null ? parseInt(retryAfterHeader, 10) : null,
  };
}

/**
 * Resets the rate limit counter for the specified client ID (/api/reset).
 *
 * @param {string} [clientId] - Client identifier.
 * @returns {Promise<any>}
 */
export async function resetRateLimit(clientId) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (clientId) {
    headers['X-Client-ID'] = clientId;
  }

  const response = await fetch(`${BASE_URL}/api/reset`, {
    method: 'POST',
    headers,
  });

  return await response.json();
}

/**
 * Checks Redis connectivity and server health (/api/health).
 *
 * @returns {Promise<any>}
 */
export async function checkHealth() {
  const response = await fetch(`${BASE_URL}/api/health`, {
    method: 'GET',
  });

  return await response.json();
}
