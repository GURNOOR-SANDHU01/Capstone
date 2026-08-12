import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeInVariants } from '../../config/animationVariants';

export function FadeIn({ children, delay = 0, style = {}, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div style={style} className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={fadeInVariants}
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
