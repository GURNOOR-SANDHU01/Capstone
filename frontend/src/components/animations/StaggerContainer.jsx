import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { staggerContainerVariants, staggerItemVariants } from '../../config/animationVariants';

export function StaggerContainer({ children, style = {}, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div style={style} className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, style = {}, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div style={style} className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={staggerItemVariants}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
