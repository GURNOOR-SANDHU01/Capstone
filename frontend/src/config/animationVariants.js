/**
 * SentiMed Motion Tokens & Animation Variants
 * Professional, calm, modern healthcare motion design system.
 */

export const pageTransitionVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeIn" } }
};

export const fadeInVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }
};

export const slideUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15, ease: "easeIn" } }
};

export const scaleInVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: "easeIn" } }
};

export const staggerContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02
    }
  }
};

export const staggerItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } }
};

export const buttonHoverTap = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 }
};

export const cardHoverLift = {
  whileHover: { y: -2, transition: { duration: 0.15, ease: "easeOut" } }
};
