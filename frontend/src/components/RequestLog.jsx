import React from 'react';

export default function RequestLog({ logs = [], onClear }) {
  return (
    <section className="logs-section">
      <div className="logs-header">
        <div className="card-title" style={{ marginBottom: 0 }}>
          <span>Live Request Log</span>
        </div>
        {logs.length > 0 && onClear && (
          <button
            className="clear-logs-btn"
            onClick={onClear}
            title="Clear all logged requests"
          >
            Clear Log
          </button>
        )}
      </div>

      <div className="table-wrapper">
        {logs.length === 0 ? (
          <div className="empty-logs">
            No requests made yet. Click "Send 1 Request" or "Send Burst (10x)" to test.
          </div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Client ID</th>
                <th>Status</th>
                <th>Remaining Quota</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.timestamp}</td>
                  <td>{log.clientId}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        log.isInfo
                          ? 'info'
                          : log.status === 200 || log.isOk
                          ? 'ok'
                          : 'error'
                      }`}
                    >
                      {log.status === 200
                        ? '200 OK'
                        : log.status === 429
                        ? '429 Too Many Requests'
                        : log.statusText || `${log.status}`}
                    </span>
                  </td>
                  <td>{log.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
