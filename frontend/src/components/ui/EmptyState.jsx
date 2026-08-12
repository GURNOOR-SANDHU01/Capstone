import React from 'react';

export function EmptyState({ 
  icon: Icon, 
  title = "No data found", 
  description, 
  action 
}) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {Icon && <Icon size={36} opacity={0.5} />}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{title}</h3>
      {description && <p style={{ fontSize: 13, maxWidth: 360 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
