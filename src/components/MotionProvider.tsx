'use client';

import React from 'react';
import { MotionConfig } from 'motion/react';

/**
 * `reducedMotion="user"` makes Motion follow the operating system. With Reduce motion on it
 * drops every transform and layout animation and renders the final state at once, keeping
 * only opacity. The spinners are CSS, and globals.css exempts them separately.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
