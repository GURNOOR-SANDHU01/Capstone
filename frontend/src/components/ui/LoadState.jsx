import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Consistent loading / error feedback for data-backed views.
 * Renders nothing when there is neither a load in progress nor an error.
 */
export function LoadState({ loading, error, onRetry, label = "Loading..." }) {
  if (error) {
    return (
      <div className="card" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C0392B' }}>
        <AlertCircle size={18} />
        <span style={{ fontSize: 13, flex: 1 }}>{error}</span>
        {onRetry && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            <RefreshCw size={14} /> <span>Retry</span>
          </button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--color-text-muted)' }}>
        <Loader2 size={24} className="spin-anim" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: 8, fontSize: 13 }}>{label}</p>
      </div>
    );
  }
  return null;
}
