import React from 'react';

export function Badge({ 
  children, 
  variant = 'primary', // 'primary', 'warning', 'danger', 'muted'
  icon: Icon,
  style = {},
  className = ''
}) {
  const badgeClasses = {
    primary: 'badge-primary',
    warning: 'badge-warning',
    danger: 'badge-danger',
    muted: 'badge-muted'
  };

  return (
    <span 
      className={`badge ${badgeClasses[variant] || 'badge-primary'} ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
