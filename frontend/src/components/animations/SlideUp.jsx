import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { slideUpVariants } from '../../config/animationVariants';

export function SlideUp({ children, delay = 0, style = {}, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div style={style} className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={slideUpVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
