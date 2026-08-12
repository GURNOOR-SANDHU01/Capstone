import React from 'react';

export function Card({ 
  children, 
  title, 
  subtitle, 
  action, 
  variant = 'default', // 'default', 'highlighted', 'bordered'
  style = {},
  className = ''
}) {
  const variantStyles = variant === 'highlighted' ? {
    background: 'linear-gradient(135deg, #1A1A2E 0%, #2E7D62 100%)',
    color: '#FFFFFF'
  } : {};

  return (
    <div 
      className={`card ${className}`} 
      style={{ ...variantStyles, ...style }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subtitle ? 4 : 12 }}>
          <div>
            {title && <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 12, color: variant === 'highlighted' ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
