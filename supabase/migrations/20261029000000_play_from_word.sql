-- Profile setting: gesture on a word that plays the voice-over from there; the other gesture
-- translates it. 'double_tap': tap = translate, double tap = play (default);
-- 'tap': tap = play, double tap = translate. On a page with an aligned voice-over the single
-- tap waits a moment before acting, to tell it from a double tap.
alter table public.user_stats
  add column play_from_word text not null default 'double_tap'
  check (play_from_word in ('double_tap', 'tap'));
