import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { Spotlight, type Rect } from '@/components/Spotlight';
import { useI18n, type Messages } from '@/i18n';
import { useAuth } from './auth';
import { TOUR_STEPS, type TourScreen, type TourStep } from './tourSteps';

/** Screens whose tour the user has already been shown (per account, on this device). */
type Seen = { screens: TourScreen[] };
type Stored = { userId: string; seen: Seen };

type Size = { width: number; height: number };
type Active = {
  screen: TourScreen;
  steps: TourStep[];
  index: number;
  rect: Rect | null;
  size: Size;
};

type TourContextValue = {
  targets: Map<string, View>;
  start: (screen: TourScreen) => void;
  replay: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

const storageKey = (userId: string) => `fabl.tour.v1.${userId}`;
/** Lets entering animations finish before measuring the targets. */
const START_DELAY = 600;
/** A tall target (the passage text) is cut so the bubble still fits beside it. */
const MAX_HOLE_RATIO = 0.45;

/**
 * Demo of the app: a spotlight tour the first time each screen is opened
 * (see `TOUR_STEPS`). "Revoir la démo" in the profile resets it.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [stored, setStored] = useState<Stored | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const targets = useMemo(() => new Map<string, View>(), []);
  // The overlay covers this view: targets are measured relative to it, as
  // window coordinates may be offset (e.g. by the Android status bar).
  const rootRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  // Null until loaded (and when signed out): nothing is shown meanwhile.
  const seen = stored?.userId === userId ? stored.seen : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        const screens: TourScreen[] = raw ? (JSON.parse(raw).screens ?? []) : [];
        setStored({ userId, seen: { screens } });
      })
      .catch((e) => console.warn('tour load', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!stored) return;
    AsyncStorage.setItem(storageKey(stored.userId), JSON.stringify(stored.seen)).catch((e) =>
      console.warn('tour save', e),
    );
  }, [stored]);

  const update = useCallback((change: (s: Seen) => Seen) => {
    setStored((prev) => prev && { ...prev, seen: change(prev.seen) });
  }, []);

  /** Shows step `from`, skipping those whose target is gone or off screen. */
  const show = useCallback(
    (screen: TourScreen, steps: TourStep[], from: number) => {
      const root = rootRef.current;
      if (!root) return;
      const finish = () => {
        setActive(null);
        update((s) => ({ screens: [...s.screens, screen] }));
      };
      root.measureInWindow((rootX, rootY, width, height) => {
        const size = { width, height };
        const visit = (index: number) => {
          const step = steps[index];
          if (!step) return finish();
          if (step.centered) return setActive({ screen, steps, index, rect: null, size });
          const node = targets.get(`${screen}.${step.id}`);
          if (!node) return visit(index + 1);
          node.measureInWindow((x, y, w, h) => {
            const rect = visibleRect(
              { x: x - rootX, y: y - rootY, width: w, height: h },
              height,
              insets,
            );
            if (rect) setActive({ screen, steps, index, rect, size });
            else visit(index + 1);
          });
        };
        visit(from);
      });
    },
    [targets, update, insets],
  );

  const start = useCallback(
    (screen: TourScreen) => {
      if (!seen || seen.screens.includes(screen) || active) return;
      const steps = TOUR_STEPS[screen].filter(
        (s) => s.centered || targets.has(`${screen}.${s.id}`),
      );
      show(screen, steps, 0);
    },
    [seen, active, targets, show],
  );

  const skip = useCallback(() => {
    if (active) show(active.screen, [], 0);
  }, [active, show]);

  const replay = useCallback(() => {
    setActive(null);
    update(() => ({ screens: [] }));
  }, [update]);

  // Android back button: leaves the demo instead of the screen under it.
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      skip();
      return true;
    });
    return () => sub.remove();
  }, [active, skip]);

  const texts = active && stepTexts(t, active.screen, active.steps[active.index]!);

  return (
    <TourContext.Provider value={{ targets, start, replay }}>
      <View ref={rootRef} collapsable={false} style={styles.root}>
        {children}
        {active && texts ? (
          <Spotlight
            title={texts.title}
            text={texts.text}
            index={active.index}
            count={active.steps.length}
            rect={active.rect}
            size={active.size}
            onNext={() => show(active.screen, active.steps, active.index + 1)}
            onSkip={skip}
          />
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

/**
 * Runs the tour of `screen` the first time it gets focus, once `ready` (its
 * data loaded). `target(id)` is a ref for the elements named in its steps
 * (put it on a plain <View collapsable={false}>).
 */
export function useTour(screen: TourScreen, ready = true) {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  const { targets, start, replay } = ctx;

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      const timer = setTimeout(() => start(screen), START_DELAY);
      return () => clearTimeout(timer);
    }, [ready, screen, start]),
  );

  const target = useCallback(
    (id: string) => (node: View | null) => {
      if (!node) return;
      const key = `${screen}.${id}`;
      targets.set(key, node);
      return () => {
        // Another instance of the screen may have registered since.
        if (targets.get(key) === node) targets.delete(key);
      };
    },
    [screen, targets],
  );

  return { target, replay };
}

const stepTexts = (t: Messages, screen: TourScreen, step: TourStep) =>
  (t.tour[screen] as Record<string, { title: string; text: string }>)[step.id];

/** Part of `r` between the safe areas, or null when (almost) nothing is visible. */
function visibleRect(r: Rect, screenHeight: number, insets: EdgeInsets): Rect | null {
  const top = Math.max(r.y, insets.top);
  const bottom = Math.min(
    r.y + r.height,
    screenHeight - insets.bottom,
    top + screenHeight * MAX_HOLE_RATIO,
  );
  if (bottom - top < 24) return null;
  return { x: r.x, y: top, width: r.width, height: bottom - top };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
