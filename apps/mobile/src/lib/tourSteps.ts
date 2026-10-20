/** Screens that have a guided tour, shown the first time each one is opened. */
export type TourScreen = 'home' | 'story' | 'reader' | 'vocabulary' | 'profile';

/**
 * One bubble; its texts are `t.tour[screen][id]`. The highlighted element is
 * the one registered with `useTour().target(id)` on that screen, unless the
 * step is `centered`. A step whose target is missing (e.g. a page without
 * audio) or off screen is skipped.
 */
export type TourStep = { id: string; centered?: boolean };

export const TOUR_STEPS: Record<TourScreen, TourStep[]> = {
  home: [{ id: 'stats' }, { id: 'stories' }, { id: 'tabs' }],
  story: [{ id: 'summary' }, { id: 'chapters' }],
  reader: [{ id: 'text' }, { id: 'audio' }, { id: 'next' }],
  vocabulary: [{ id: 'review' }, { id: 'search' }],
  profile: [{ id: 'goal' }, { id: 'readAlong' }, { id: 'language' }, { id: 'replay' }],
};
