-- Onboarding: new accounts choose their daily goal right after their language.
-- Null: not chosen yet (the app shows the goal screen). Existing accounts keep theirs.
alter table public.user_stats
  alter column daily_goal_minutes drop not null,
  alter column daily_goal_minutes drop default;
