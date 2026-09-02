import type { Transition, Variants } from 'motion/react';

/**
 * Motion's own tokens, kept in step with the CSS custom properties in globals.css.
 * The library cannot read those, so the numbers are repeated here and nowhere else.
 *
 * DESIGN.md sets the durations: instant 120ms, fast 180ms, base 260ms, exit 170ms,
 * which is about 65% of the entrance. Easing `--ease-out` is cubic-bezier(0.16, 1, 0.3, 1).
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** The card growing or shrinking as its body opens. Reads as weight, not bounce. */
export const CARD_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/** Rows sliding to new places after a sort change. Slower, because more of them move. */
export const REORDER_SPRING: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 1,
};

export const FADE_IN: Transition = { duration: 0.18, ease: EASE_OUT };
export const FADE_OUT: Transition = { duration: 0.17, ease: EASE_IN };

/** 300ms total, 30ms apart, capped so a 30 card list is no slower than a 10 card one. */
const REVEAL_STAGGER_S = 0.03;
const REVEAL_CAP_S = 0.3;

export function revealDelay(index: number): number {
  return Math.min(index * REVEAL_STAGGER_S, REVEAL_CAP_S);
}

/**
 * The list reveal, from DESIGN.md: opacity 0 to 1, translateY 8px to 0, 300ms.
 * It runs on first paint only. A row that arrives from the event stream must not move,
 * so the list passes `initial={false}` once it has painted.
 */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0 },
  // The exit carries its own transition, because a Transition object has no `exit` key.
  gone: { opacity: 0, y: -4, transition: FADE_OUT },
};
