/**
 * Daily reminders: local notifications the app schedules itself (no server, no push token).
 * Each time the app goes to the background, the coming days' reminders are rebuilt from the
 * latest state (reminderPlan.ts): one a day at the chosen hour, none on a day already done.
 *
 * The choice (on/off, hour) is kept on the device, like the notifications themselves. It is
 * asked once after the onboarding (notifications screen), then changed in the profile.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useI18n } from '@/i18n';

import { fetchUnlocks } from './api/allowance';
import { fetchStories } from './api/content';
import { fetchProgressByStory } from './api/progress';
import { fetchDueDates } from './api/vocabulary';
import { useAuth } from './auth';
import { displayedStreak, goalSeconds } from './gamification';
import { usePremium } from './premium';
import { PLAN_DAYS, planReminders } from './reminderPlan';
import { useStats } from './stats';

const STORAGE_KEY = 'fabl.reminders';
const CHANNEL_ID = 'reminders';
/** Hours offered for the reminder. */
export const REMINDER_HOURS = [8, 12, 18, 19, 20, 21] as const;
const DEFAULT_HOUR = 19;
/** Local notifications don't exist on the web version (store screenshots). */
export const REMINDERS_SUPPORTED = Platform.OS !== 'web';

type Prefs = {
  /** The question was asked (notifications screen): not asked again. */
  asked: boolean;
  enabled: boolean;
  hour: number;
  /** Always 0, except when set by hand in a development build (ReminderTestTime). */
  minute?: number;
};

/** Whether the phone lets the app notify; 'denied' can only be changed in its settings. */
export type ReminderPermission = 'granted' | 'undetermined' | 'denied';

type RemindersValue = {
  /** False until the choice saved on this device is read. */
  ready: boolean;
  prefs: Prefs;
  permission: ReminderPermission;
  /** Asks the phone's permission; true when the reminders are on. */
  enable: (hour?: number) => Promise<boolean>;
  disable: () => void;
  setHour: (hour: number) => void;
  /** Development builds only: any hour and minute, to test the notifications. */
  setTime: (hour: number, minute: number) => void;
  /** "Later" on the notifications screen. */
  skip: () => void;
};

const DEFAULT_PREFS: Prefs = { asked: false, enabled: false, hour: DEFAULT_HOUR };

const RemindersContext = createContext<RemindersValue | null>(null);

if (REMINDERS_SUPPORTED) {
  // Shown even when the app is open (a reminder can fire while reading).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const toPermission = (p: Notifications.NotificationPermissionsStatus): ReminderPermission =>
  p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ? 'granted'
    : p.canAskAgain
      ? 'undetermined'
      : 'denied';

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const { stats, todaySeconds } = useStats();
  const { premium } = usePremium();
  const { t, lang } = useI18n();
  const [prefs, setPrefs] = useState<Prefs | null>(REMINDERS_SUPPORTED ? null : DEFAULT_PREFS);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');

  const save = useCallback((next: Prefs) => {
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) =>
      console.warn('save reminders', e),
    );
  }, []);

  const readPermission = useCallback(async () => {
    setPermission(toPermission(await Notifications.getPermissionsAsync()));
  }, []);

  useEffect(() => {
    if (!REMINDERS_SUPPORTED) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setPrefs(value ? { ...DEFAULT_PREFS, ...JSON.parse(value) } : DEFAULT_PREFS))
      .catch(() => setPrefs(DEFAULT_PREFS));
    Notifications.getPermissionsAsync()
      .then((p) => setPermission(toPermission(p)))
      .catch(console.warn);
    // Notifications may have been allowed or blocked in the phone's settings meanwhile.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') readPermission().catch(console.warn);
    });
    return () => sub.remove();
  }, [readPermission]);

  // Android: the channel must exist before asking (Android 13+ shows no prompt otherwise).
  const channelName = t.reminders.channel;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: AndroidImportance.DEFAULT,
    }).catch(console.warn);
  }, [channelName]);

  const current = prefs ?? DEFAULT_PREFS;

  const enable = useCallback(
    async (hour?: number) => {
      const result = toPermission(await Notifications.requestPermissionsAsync());
      setPermission(result);
      const on = result === 'granted';
      save(
        hour === undefined
          ? { ...current, asked: true, enabled: on }
          : { asked: true, enabled: on, hour, minute: 0 },
      );
      return on;
    },
    [current, save],
  );
  const disable = useCallback(
    () => save({ ...current, asked: true, enabled: false }),
    [current, save],
  );
  const setHour = useCallback(
    (hour: number) => save({ ...current, hour, minute: 0 }),
    [current, save],
  );
  const setTime = useCallback(
    (hour: number, minute: number) => save({ ...current, hour, minute }),
    [current, save],
  );
  const minute = current.minute ?? 0;
  const skip = useCallback(
    () => save({ ...current, asked: true, enabled: false }),
    [current, save],
  );

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  const active =
    REMINDERS_SUPPORTED && !!session && current.enabled && permission === 'granted' && !!stats;
  // Off, blocked or signed out: nothing may stay scheduled. (Not while still loading: an
  // offline start keeps the reminders planned last time.)
  const cleared =
    REMINDERS_SUPPORTED &&
    prefs !== null &&
    (!prefs.enabled || permission === 'denied' || (authReady && !session));

  // Read when scheduling, so the practice time ticking does not reschedule every minute.
  const latest = useRef({ stats, todaySeconds, premium, t, hour: current.hour, minute });
  useEffect(() => {
    latest.current = { stats, todaySeconds, premium, t, hour: current.hour, minute };
  });

  const schedule = useCallback(async () => {
    const {
      stats: s,
      todaySeconds: seconds,
      premium: isPremium,
      t: messages,
      hour,
      minute: atMinute,
    } = latest.current;
    if (!s) return;
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + PLAN_DAYS);
    until.setHours(23, 59, 59, 999);

    // Everything is read before the old reminders are cancelled: offline, they stay.
    const [dueDates, chapter] = await Promise.all([
      fetchDueDates(until),
      isPremium ? null : premiumStoryInProgress(),
    ]);
    const plan = planReminders(
      {
        now,
        hour,
        minute: atMinute,
        goalMinutes: goalSeconds(s) / 60,
        todaySeconds: seconds,
        goalReachedToday: seconds >= goalSeconds(s),
        streak: displayedStreak(s),
        dueDates,
        chapterStory: chapter?.story ?? null,
        unlockUsedToday: chapter?.usedToday ?? false,
      },
      messages.reminders,
    );

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { url: r.url } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.date,
          channelId: CHANNEL_ID,
        },
      });
    }
  }, []);

  const goalReached = !!stats && todaySeconds >= goalSeconds(stats);
  useEffect(() => {
    if (cleared) {
      Notifications.cancelAllScheduledNotificationsAsync().catch(console.warn);
      return;
    }
    if (!active) return;
    // Settles first: several of these values change together at launch.
    const timer = setTimeout(() => schedule().catch((e) => console.warn('reminders', e)), 1500);
    return () => clearTimeout(timer);
  }, [
    active,
    cleared,
    schedule,
    current.hour,
    minute,
    goalReached,
    premium,
    lang,
    stats?.current_streak,
    stats?.daily_goal_minutes,
  ]);

  // Leaving the app: the latest state (goal reached, words reviewed, chapter read).
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') schedule().catch((e) => console.warn('reminders', e));
    });
    return () => sub.remove();
  }, [active, schedule]);

  return (
    <RemindersContext.Provider
      value={{
        ready: prefs !== null,
        prefs: current,
        permission,
        enable,
        disable,
        setHour,
        setTime,
        skip,
      }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersValue {
  const value = useContext(RemindersContext);
  if (!value) throw new Error('useReminders outside RemindersProvider');
  return value;
}

/**
 * Free account: the premium story read last and not finished, whose next chapter the daily
 * unlock opens, and whether today's unlock is used.
 */
async function premiumStoryInProgress() {
  const stories = (await fetchStories()).filter((s) => s.premium);
  if (!stories.length) return null;
  const [progress, unlocks] = await Promise.all([fetchProgressByStory(stories), fetchUnlocks()]);
  const reading = stories
    .filter((s) => {
      const p = progress.get(s.id);
      return p?.lastReadAt && p.fraction < 1;
    })
    .sort((a, b) => progress.get(b.id)!.lastReadAt!.localeCompare(progress.get(a.id)!.lastReadAt!));
  const story = reading[0];
  return story
    ? { story: { id: story.id, title: story.title }, usedToday: unlocks.usedToday }
    : null;
}

/** Tapping a reminder opens what it is about (words to review, the story). */
export function ReminderLinks() {
  return REMINDERS_SUPPORTED ? <ReminderLinksInner /> : null;
}

function ReminderLinksInner() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = response.notification.request.content.data?.url;
    Notifications.clearLastNotificationResponse();
    if (typeof url === 'string' && url !== '/') router.push(url as Href);
  }, [response, router]);
  return null;
}
