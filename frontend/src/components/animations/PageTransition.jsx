import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageTransitionVariants } from '../../config/animationVariants';

export function PageTransition({ children, style = {}, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div style={style} className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: "100%", ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
