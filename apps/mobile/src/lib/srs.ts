/**
 * Simplified SM-2 spaced repetition.
 *
 * Each review gets a grade; it maps to an SM-2 quality (0–5):
 *   again → 1, hard → 3, good → 4, easy → 5
 * - quality < 3: the word is relearned (repetitions reset, back tomorrow);
 * - otherwise intervals grow 1 → 3 → interval × ease days;
 * - ease moves with the standard SM-2 formula, floored at 1.3.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export type SrsState = { intervalDays: number; ease: number; repetitions: number };

export type SrsResult = SrsState & { dueAt: Date };

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export const MIN_EASE = 1.3;

export function scheduleReview(state: SrsState, grade: Grade, now = new Date()): SrsResult {
  const q = QUALITY[grade];
  const ease = Math.max(MIN_EASE, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let repetitions: number;
  let intervalDays: number;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(state.intervalDays * ease);
    // "Hard" still passes but grows slower; "easy" gets a small boost.
    if (grade === 'hard') intervalDays = Math.max(1, Math.round(intervalDays * 0.8));
    if (grade === 'easy') intervalDays = Math.round(intervalDays * 1.3);
  }

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);
  // Due at the start of that day, so it counts for "today" all day long.
  dueAt.setHours(0, 0, 0, 0);

  return { intervalDays, ease: Math.round(ease * 100) / 100, repetitions, dueAt };
}
