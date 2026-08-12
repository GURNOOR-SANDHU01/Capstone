import React from 'react';

export function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  badge, 
  action 
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && <Icon size={22} color="var(--color-primary-dark)" />}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>{title}</h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>{description}</p>
        )}
      </div>

      {action && <div>{action}</div>}
    </div>
  );
}
