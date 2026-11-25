import React from 'react';

export default function QuotaCard({
  clientId = 'user-1',
  remaining = 5,
  limit = 5,
  countdown = 0,
  redisHealthy = null,
}) {
  const quotaPercent = Math.max(
    0,
    Math.min(100, Math.round((remaining / limit) * 100))
  );

  const getQuotaColorClass = () => {
    if (remaining === 0) return 'empty';
    if (remaining <= 2) return 'low';
    return '';
  };

  const getProgressFillClass = () => {
    if (quotaPercent <= 25) return 'low';
    if (quotaPercent <= 60) return 'medium';
    return 'high';
  };

  return (
    <section className="card quota-card">
      <div className="card-title">
        <span>Live Quota Status ({clientId})</span>
        <div className="health-badge" style={{ padding: '0.25rem 0.65rem' }}>
          <span
            className={`health-dot ${
              redisHealthy === true
                ? 'healthy'
                : redisHealthy === false
                ? 'unhealthy'
                : ''
            }`}
          />
          <span>
            {redisHealthy === true
              ? 'Redis Connected'
              : redisHealthy === false
              ? 'Redis Offline'
              : 'Checking...'}
          </span>
        </div>
      </div>

      <div className="status-stats-grid">
        <div className="stat-box">
          <div className="stat-label">Remaining</div>
          <div className={`stat-value remaining ${getQuotaColorClass()}`}>
            {remaining}
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Max Limit</div>
          <div className="stat-value">{limit}</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Window Reset</div>
          <div className="stat-value timer">
            {countdown > 0 ? `${countdown}s` : 'Ready'}
          </div>
        </div>
      </div>

      <div className="quota-progress-container">
        <div className="progress-header">
          <span>Quota Capacity</span>
          <span>
            {remaining} of {limit} remaining ({quotaPercent}%)
          </span>
        </div>
        <div className="progress-bar-bg">
          <div
            className={`progress-bar-fill ${getProgressFillClass()}`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
