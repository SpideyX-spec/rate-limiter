import React, { useState, useEffect } from 'react';
import { fetchProtectedData, resetRateLimit, checkHealth } from './services/api';
import ControlPanel from './components/ControlPanel';
import QuotaCard from './components/QuotaCard';
import RequestLog from './components/RequestLog';
import './App.css';

export default function App() {
  const [clientId, setClientId] = useState('user-1');
  const [quota, setQuota] = useState({
    limit: 5,
    remaining: 5,
    reset: 0,
  });
  const [countdown, setCountdown] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redisHealthy, setRedisHealthy] = useState(null);

  // Countdown timer effect
  useEffect(() => {
    if (countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  // Periodic health check
  useEffect(() => {
    const runHealthCheck = async () => {
      try {
        const res = await checkHealth();
        setRedisHealthy(Boolean(res && (res.redis ?? res.redis_connected)));
      } catch (err) {
        setRedisHealthy(false);
      }
    };

    runHealthCheck();
    const healthInterval = setInterval(runHealthCheck, 10000);
    return () => clearInterval(healthInterval);
  }, []);

  const addLog = (entry) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        ...entry,
      },
      ...prev,
    ]);
  };

  // Send a single request to /api/data
  const handleSendSingle = async () => {
    setLoading(true);
    try {
      const res = await fetchProtectedData(clientId);

      const limit = res.limit !== null ? res.limit : quota.limit;
      const remaining = res.remaining !== null ? res.remaining : 0;
      const reset = res.reset !== null ? res.reset : 0;

      setQuota({ limit, remaining, reset });
      if (reset > 0) {
        setCountdown(reset);
      }

      addLog({
        clientId,
        status: res.status,
        statusText: res.status === 200 ? '200 OK' : '429 Too Many Requests',
        remaining: `${remaining} / ${limit}`,
        isOk: res.status === 200,
      });
    } catch (err) {
      addLog({
        clientId,
        status: 500,
        statusText: 'Network / Error',
        remaining: 'N/A',
        isOk: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Send a burst of 10 parallel requests
  const handleSendBurst = async () => {
    setLoading(true);
    try {
      const requests = Array.from({ length: 10 }, () =>
        fetchProtectedData(clientId)
      );

      const results = await Promise.all(requests);

      results.forEach((res) => {
        const limit = res.limit !== null ? res.limit : quota.limit;
        const remaining = res.remaining !== null ? res.remaining : 0;

        addLog({
          clientId,
          status: res.status,
          statusText: res.status === 200 ? '200 OK' : '429 Too Many Requests',
          remaining: `${remaining} / ${limit}`,
          isOk: res.status === 200,
        });
      });

      const lastResult = results[results.length - 1];
      const limit = lastResult.limit !== null ? lastResult.limit : quota.limit;
      const remaining = lastResult.remaining !== null ? lastResult.remaining : 0;
      const reset = lastResult.reset !== null ? lastResult.reset : 0;

      setQuota({ limit, remaining, reset });
      if (reset > 0) {
        setCountdown(reset);
      }
    } catch (err) {
      addLog({
        clientId,
        status: 500,
        statusText: 'Burst Failed',
        remaining: 'N/A',
        isOk: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset rate limit quota for active client ID
  const handleResetQuota = async () => {
    setLoading(true);
    try {
      await resetRateLimit(clientId);
      setQuota((prev) => ({
        ...prev,
        remaining: prev.limit,
        reset: 0,
      }));
      setCountdown(0);

      addLog({
        clientId,
        status: 200,
        statusText: 'Quota Reset',
        remaining: `${quota.limit} / ${quota.limit}`,
        isOk: true,
        isInfo: true,
      });
    } catch (err) {
      addLog({
        clientId,
        status: 500,
        statusText: 'Reset Failed',
        remaining: 'N/A',
        isOk: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="title-section">
          <h1>Sliding Window Rate Limiter</h1>
          <p>Real-time Redis Sorted Set Rate Limiter Visualizer</p>
        </div>
      </header>

      {/* Top Grid: ControlPanel & QuotaCard */}
      <div className="top-grid">
        <ControlPanel
          clientId={clientId}
          setClientId={setClientId}
          onSendSingle={handleSendSingle}
          onSendBurst={handleSendBurst}
          onResetQuota={handleResetQuota}
          loading={loading}
        />

        <QuotaCard
          clientId={clientId}
          remaining={quota.remaining}
          limit={quota.limit}
          countdown={countdown}
          redisHealthy={redisHealthy}
        />
      </div>

      {/* Scrollable Request Log Table */}
      <RequestLog logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}
