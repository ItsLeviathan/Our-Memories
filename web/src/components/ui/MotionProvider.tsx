"use client";

import { MotionConfig } from "motion/react";

/** Honors the OS "reduce motion" setting for every animation in the app. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
