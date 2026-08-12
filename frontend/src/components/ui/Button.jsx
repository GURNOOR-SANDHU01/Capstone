import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export function Button({ 
  children, 
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  loading = false,
  disabled = false,
  icon: Icon,
  onClick,
  type = 'button',
  style = {},
  className = '',
  ...props 
}) {
  const shouldReduceMotion = useReducedMotion();

  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-outline'
  };

  const extraStyles = variant === 'danger' ? {
    borderColor: 'rgba(224,92,92,0.3)',
    color: 'var(--color-danger)'
  } : {};

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={shouldReduceMotion || disabled || loading ? {} : { scale: 1.01 }}
      whileTap={shouldReduceMotion || disabled || loading ? {} : { scale: 0.98 }}
      className={`btn ${variantClasses[variant] || 'btn-primary'} ${sizeClasses[size] || ''} ${className}`}
      style={{ ...extraStyles, ...style }}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="spin-anim" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : null}
      {children && <span>{children}</span>}
    </motion.button>
  );
}
