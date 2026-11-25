import React from 'react';

export default function ControlPanel({
  clientId = 'user-1',
  setClientId,
  onSendSingle,
  onSendBurst,
  onResetQuota,
  loading = false,
}) {
  const quickClients = ['user-1', 'user-2', 'alice', 'bob'];

  return (
    <section className="card control-panel-card">
      <div className="card-title">
        <span>Client Identity & Actions</span>
      </div>

      <div className="input-group">
        <label htmlFor="clientId" className="input-label">
          Client ID (Sent as X-Client-ID):
        </label>
        <input
          id="clientId"
          type="text"
          className="client-input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="e.g. user-1"
        />
        <div className="quick-clients">
          {quickClients.map((name) => (
            <button
              key={name}
              type="button"
              className={`client-chip ${clientId === name ? 'active' : ''}`}
              onClick={() => setClientId(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="actions-group">
        <button
          className="btn btn-primary"
          onClick={onSendSingle}
          disabled={loading}
        >
          Send 1 Request
        </button>
        <button
          className="btn btn-burst"
          onClick={onSendBurst}
          disabled={loading}
        >
          Send Burst (10x)
        </button>
        <button
          className="btn btn-reset"
          onClick={onResetQuota}
          disabled={loading}
        >
          Reset Quota
        </button>
      </div>
    </section>
  );
}
