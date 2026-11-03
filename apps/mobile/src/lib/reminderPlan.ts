/**
 * Which reminder to send on each of the coming days (pure: see reminders.tsx for the
 * scheduling). At most one notification a day, at the chosen hour, so they never pile up.
 *
 * What the app knows now decides the messages: today's goal and streak, the words that
 * fall due each day, the premium story a free account is reading (one chapter unlocks a
 * day). The plan is rebuilt every time the app goes to the background, so a day already
 * done gets no reminder and the next ones follow the latest state.
 */
import type { Messages } from '@/i18n';

/** Days planned ahead: a user who stops opening the app stops being reminded after that. */
export const PLAN_DAYS = 7;
/** Days without the app after which the message invites back instead. */
const COMEBACK_DAYS = [3, 6];

export type PlanInput = {
  now: Date;
  hour: number;
  /** 0 in the app; set by hand only in development builds (testing). */
  minute: number;
  goalMinutes: number;
  todaySeconds: number;
  /** Today's goal is reached (the day counts for the streak). */
  goalReachedToday: boolean;
  /** Streak still alive (reached today or yesterday). */
  streak: number;
  /** When each word of the list falls due. */
  dueDates: Date[];
  /** Free account reading a premium story: its next chapter opens with the daily unlock. */
  chapterStory: { id: string; title: string } | null;
  /** The free account already used today's unlock. */
  unlockUsedToday: boolean;
};

/** `body` null: the title alone (the chapter of the day, the daily goal). */
export type Reminder = { date: Date; title: string; body: string | null; url: string };

type Candidate = Omit<Reminder, 'date'> | null;

export function planReminders(input: PlanInput, t: Messages['reminders']): Reminder[] {
  const plan: Reminder[] = [];
  for (let day = 0; day < PLAN_DAYS; day++) {
    const date = new Date(input.now);
    date.setDate(date.getDate() + day);
    date.setHours(input.hour, input.minute, 0, 0);
    // Past already today, or nothing left to remind today.
    if (date.getTime() <= input.now.getTime() + 60_000) continue;
    if (day === 0 && input.goalReachedToday) continue;

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const due = input.dueDates.filter((d) => d.getTime() <= endOfDay.getTime()).length;
    const remaining = Math.max(1, Math.ceil(input.goalMinutes - input.todaySeconds / 60));

    const streak: Candidate =
      day === 0 && input.streak > 0
        ? { title: t.streakTitle(input.streak), body: t.streakBody(remaining), url: '/' }
        : // Tomorrow, after a day that counted: keep the streak going.
          day === 1 && input.goalReachedToday && input.streak > 0
          ? { title: t.keepStreakTitle(input.streak), body: t.keepStreakBody, url: '/' }
          : null;
    const chapter: Candidate =
      input.chapterStory && (day > 0 || !input.unlockUsedToday)
        ? { title: t.chapterTitle, body: null, url: `/story/${input.chapterStory.id}` }
        : null;
    const review: Candidate =
      due > 0 ? { title: t.reviewTitle(due), body: t.reviewBody, url: '/review' } : null;
    const goal: Candidate = { title: t.goalTitle, body: null, url: '/' };
    const comeback: Candidate = COMEBACK_DAYS.includes(day)
      ? { title: t.comebackTitle, body: t.comebackBody, url: '/' }
      : null;

    // Today: what is at stake first. Later days: the chapter and the words take turns (the
    // goal when there is neither), after the streak or an invitation back.
    const news = [chapter, review].filter((c) => c !== null);
    const pick =
      day === 0
        ? (streak ?? chapter ?? review ?? goal)
        : (streak ?? comeback ?? news[day % Math.max(1, news.length)] ?? goal);
    plan.push({ date, ...pick });
  }
  return plan;
}
