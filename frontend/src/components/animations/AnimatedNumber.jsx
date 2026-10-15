import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function AnimatedNumber({ value = 0, duration = 750, suffix = "" }) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(shouldReduceMotion ? value : 0);

  useEffect(() => {
    if (shouldReduceMotion) return undefined;

    let startTime = null;
    const startNum = 0;
    const targetNum = Number(value) || 0;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startNum + (targetNum - startNum) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetNum);
      }
    };

    const rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, shouldReduceMotion]);

  return <span>{shouldReduceMotion ? value : displayValue}{suffix}</span>;
}
